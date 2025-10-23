import { betterAuth, BetterAuthPlugin } from 'better-auth';
import { PrismaClient } from '../../generated/prisma';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { createAuthMiddleware } from 'better-auth/plugins';

const prisma = new PrismaClient();

const myPlugin = () => {
  return {
    id: 'disable-registrations-plugin',
    hooks: {
      before: [
        {
          matcher: (context: any) => {
            if (context.path === '/sign-up/email') {
              return true;
            }
            return false;
          },
          handler: createAuthMiddleware(async (ctx) => {
            if (ctx.path === '/sign-up/email') {
              return {
                status: 403,
                body: { message: 'Registrations are disabled.' },
              };
            }
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
};

export const auth = betterAuth({
  plugins: [myPlugin()],
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  trustedOrigins: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://honydev.fr',
  ],
  emailAndPassword: {
    enabled: true,
  },
  database: prismaAdapter(prisma, {
    provider: 'postgresql', // or "mysql", "postgresql", ...etc
  }),
});
