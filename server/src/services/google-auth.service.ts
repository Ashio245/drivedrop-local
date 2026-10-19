import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../lib/prisma.js';
import { encrypt, decrypt } from '../lib/crypto.js';
import { config } from '../config.js';

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
];

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export class GoogleAuthService {
  private static instance: GoogleAuthService;

  public static getInstance(): GoogleAuthService {
    if (!GoogleAuthService.instance) {
      GoogleAuthService.instance = new GoogleAuthService();
    }
    return GoogleAuthService.instance;
  }

  /**
   * Retrieves OAuth Client configuration from database or env.
   */
  public async getOAuthConfig(): Promise<OAuthConfig> {
    const dbClientId = await prisma.appSetting.findUnique({ where: { id: 'GOOGLE_CLIENT_ID' } });
    const dbClientSecret = await prisma.appSetting.findUnique({ where: { id: 'GOOGLE_CLIENT_SECRET' } });
    const dbRedirectUri = await prisma.appSetting.findUnique({ where: { id: 'GOOGLE_REDIRECT_URI' } });

    const clientId = dbClientId?.value || config.googleClientId || '';
    const clientSecret = dbClientSecret?.isSecret ? decrypt(dbClientSecret.value) : (dbClientSecret?.value || config.googleClientSecret || '');
    const redirectUri = dbRedirectUri?.value || config.googleRedirectUri || 'http://127.0.0.1:3001/api/auth/callback';

    return { clientId, clientSecret, redirectUri };
  }

  /**
   * Saves user-configured OAuth client credentials.
   */
  public async saveOAuthConfig(cfg: { clientId: string; clientSecret: string; redirectUri?: string }): Promise<void> {
    await prisma.appSetting.upsert({
      where: { id: 'GOOGLE_CLIENT_ID' },
      create: { id: 'GOOGLE_CLIENT_ID', value: cfg.clientId, isSecret: false },
      update: { value: cfg.clientId },
    });

    await prisma.appSetting.upsert({
      where: { id: 'GOOGLE_CLIENT_SECRET' },
      create: { id: 'GOOGLE_CLIENT_SECRET', value: encrypt(cfg.clientSecret), isSecret: true },
      update: { value: encrypt(cfg.clientSecret), isSecret: true },
    });

    if (cfg.redirectUri) {
      await prisma.appSetting.upsert({
        where: { id: 'GOOGLE_REDIRECT_URI' },
        create: { id: 'GOOGLE_REDIRECT_URI', value: cfg.redirectUri, isSecret: false },
        update: { value: cfg.redirectUri },
      });
    }
  }

  /**
   * Creates an authorized OAuth2Client instance using credentials.
   */
  public async getOAuthClient(): Promise<OAuth2Client> {
    const { clientId, clientSecret, redirectUri } = await this.getOAuthConfig();
    if (!clientId || !clientSecret) {
      throw new Error('Google OAuth credentials are not configured. Please provide Client ID and Client Secret in Settings.');
    }

    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  /**
   * Generates authorization consent URL with a secure state parameter.
   */
  public async generateAuthUrl(fullDriveScope: boolean = false): Promise<string> {
    const oauth2Client = await this.getOAuthClient();
    const scopes = fullDriveScope
      ? ['https://www.googleapis.com/auth/drive', ...SCOPES.slice(1)]
      : SCOPES;

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: scopes,
    });
  }

  /**
   * Exchanges authorization code for tokens, fetches user info, and saves encrypted credentials.
   */
  public async handleCallback(code: string): Promise<{ email: string; name: string }> {
    const oauth2Client = await this.getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Fetch user profile
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    const email = userInfo.data.email || 'user@local';
    const name = userInfo.data.name || 'Google User';
    const avatar = userInfo.data.picture || null;

    const encryptedAccessToken = tokens.access_token ? encrypt(tokens.access_token) : null;
    const encryptedRefreshToken = tokens.refresh_token ? encrypt(tokens.refresh_token) : null;
    const tokenExpiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : null;

    // Persist to GoogleAuth table
    const existing = await prisma.googleAuth.findUnique({ where: { id: 'primary' } });
    await prisma.googleAuth.upsert({
      where: { id: 'primary' },
      create: {
        id: 'primary',
        userEmail: email,
        userName: name,
        userAvatar: avatar,
        encryptedAccessToken,
        encryptedRefreshToken,
        tokenExpiresAt,
        scope: tokens.scope || null,
      },
      update: {
        userEmail: email,
        userName: name,
        userAvatar: avatar,
        encryptedAccessToken: encryptedAccessToken ?? existing?.encryptedAccessToken,
        // Keep previous refresh token if Google didn't issue a new one on this exchange
        encryptedRefreshToken: encryptedRefreshToken ?? existing?.encryptedRefreshToken,
        tokenExpiresAt,
        scope: tokens.scope || existing?.scope,
      },
    });

    return { email, name };
  }

  /**
   * Returns a valid OAuth2 client with fresh access tokens.
   */
  public async getAuthenticatedClient(): Promise<OAuth2Client> {
    const authRecord = await prisma.googleAuth.findUnique({ where: { id: 'primary' } });
    if (!authRecord || !authRecord.encryptedRefreshToken) {
      throw new Error('Not authenticated with Google Drive. Please connect your Google account.');
    }

    const oauth2Client = await this.getOAuthClient();
    const refreshToken = decrypt(authRecord.encryptedRefreshToken);
    const accessToken = authRecord.encryptedAccessToken ? decrypt(authRecord.encryptedAccessToken) : undefined;

    oauth2Client.setCredentials({
      refresh_token: refreshToken,
      access_token: accessToken,
      expiry_date: authRecord.tokenExpiresAt ? authRecord.tokenExpiresAt.getTime() : undefined,
    });

    // Handle token refresh automatically if expired or about to expire in 60s
    if (!authRecord.tokenExpiresAt || authRecord.tokenExpiresAt.getTime() < Date.now() + 60000) {
      try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        if (credentials.access_token) {
          await prisma.googleAuth.update({
            where: { id: 'primary' },
            data: {
              encryptedAccessToken: encrypt(credentials.access_token),
              tokenExpiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
            },
          });
        }
      } catch (err: any) {
        throw new Error(`Failed to refresh Google OAuth token: ${err.message}. Please reconnect your account.`);
      }
    }

    return oauth2Client;
  }

  /**
   * Retrieves current connection status without exposing sensitive credentials.
   */
  public async getStatus(): Promise<{
    isConnected: boolean;
    hasOAuthConfig: boolean;
    user: { email: string | null; name: string | null; avatar: string | null } | null;
    defaultFolderId: string | null;
    emulatorFolderId: string | null;
  }> {
    const { clientId, clientSecret } = await this.getOAuthConfig();
    const hasOAuthConfig = Boolean(clientId && clientSecret);

    const auth = await prisma.googleAuth.findUnique({ where: { id: 'primary' } });
    if (!auth || !auth.encryptedRefreshToken) {
      return {
        isConnected: false,
        hasOAuthConfig,
        user: null,
        defaultFolderId: auth?.defaultFolderId || null,
        emulatorFolderId: auth?.emulatorFolderId || null,
      };
    }

    return {
      isConnected: true,
      hasOAuthConfig,
      user: {
        email: auth.userEmail,
        name: auth.userName,
        avatar: auth.userAvatar,
      },
      defaultFolderId: auth.defaultFolderId,
      emulatorFolderId: auth.emulatorFolderId,
    };
  }

  /**
   * Disconnects account, revokes token at Google, and wipes local credentials.
   */
  public async disconnect(): Promise<void> {
    try {
      const auth = await prisma.googleAuth.findUnique({ where: { id: 'primary' } });
      if (auth && auth.encryptedRefreshToken) {
        const refreshToken = decrypt(auth.encryptedRefreshToken);
        const client = await this.getOAuthClient();
        await client.revokeToken(refreshToken).catch(() => {});
      }
    } catch {
      // Ignore network errors on revocation
    }

    await prisma.googleAuth.deleteMany();
  }
}
