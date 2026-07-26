import type { NextAuthConfig } from 'next-auth';

// Edge-safe config (no Node.js-only imports like `pg`)
// Used by middleware for session verification only.
export const authConfig = {
  secret: process.env.AUTH_SECRET,
  pages: { signIn: '/login' },
  providers: [], // Populated in auth.ts; not needed for JWT verification in middleware
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = nextUrl;

      // Always allow these through
      if (
        pathname === '/login' ||
        pathname.startsWith('/api/auth') ||
        pathname === '/api/ebay/callback' ||
        pathname === '/api/db/setup'
      ) return true;

      // Redirect unauthenticated users to login
      if (!isLoggedIn) return false;

      // Redirect logged-in users away from login page
      if (isLoggedIn && pathname === '/login') {
        return Response.redirect(new URL('/', nextUrl));
      }

      return true;
    },
  },
} satisfies NextAuthConfig;
