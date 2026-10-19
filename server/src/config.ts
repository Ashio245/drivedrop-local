import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export interface AppConfig {
  port: number;
  host: string;
  env: string;
  databaseUrl: string;
  encryptionSecret: string;
  googleClientId?: string;
  googleClientSecret?: string;
  googleRedirectUri?: string;
}

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '3001', 10),
  host: process.env.HOST || '127.0.0.1',
  env: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'file:./data/drivedrop.db',
  encryptionSecret: process.env.ENCRYPTION_SECRET || 'drivedrop_local_secure_master_key_32bytes!!',
  googleClientId: process.env.GOOGLE_CLIENT_ID || undefined,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || undefined,
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://127.0.0.1:3001/api/auth/callback',
};
