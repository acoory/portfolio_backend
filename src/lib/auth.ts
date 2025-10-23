import { betterAuth, BetterAuthPlugin } from 'better-auth';
import { PrismaClient } from '../../generated/prisma';
import { prismaAdapter } from 'better-auth/adapters/prisma';

const prisma = new PrismaClient();

function matchRoute(request: Request, route: string, method?: string): boolean {
  try {
    const url = new URL(request.url);
    if (method) {
      return new URL(url).pathname.includes(route) && request.method === method;
    }
    return new URL(url).pathname.includes(route);
  } catch {
    return false;
  }
}

const myPlugin = () => {
  return {
    id: 'disable-registrations-plugin',
    onRequest: async (request, context: any) => {
      if (matchRoute(request, 'sign-up/email', 'POST')) {
        const allowRegistrations = process.env.ALLOW_REGISTRATIONS === 'true';
        if (!allowRegistrations) {
          return {
            response: new Response(
              JSON.stringify({ message: 'Registrations are disabled.' }),
              {
                status: 403,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          };
        }
      }
    },
  } satisfies BetterAuthPlugin;
};

export const auth = betterAuth({
  plugins: [myPlugin()],
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  trustedOrigins: [process.env.FRONTEND_URL || 'http://localhost:5173'],
  emailAndPassword: {
    enabled: true,
  },
  database: prismaAdapter(prisma, {
    provider: 'postgresql', // or "mysql", "postgresql", ...etc
  }),
});
