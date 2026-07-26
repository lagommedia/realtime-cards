import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

// Use the Edge-safe config only — no pg / Node.js imports
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
