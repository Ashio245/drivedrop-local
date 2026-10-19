import { PrismaClient } from '@prisma/client';

// Enable serialization of BigInt fields in JSON responses
declare global {
  interface BigInt {
    toJSON(): string;
  }
}

(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'test' ? [] : ['warn', 'error'],
});
