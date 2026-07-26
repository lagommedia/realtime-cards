import { auth } from '@/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  // Let login page through for unauthenticated users
  if (pathname === '/login') {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL('/', req.nextUrl.origin));
    }
    return NextResponse.next();
  }

  // Require auth for everything else
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL('/login', req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  // Run on all routes except static files, Next.js internals, and auth/eBay API callbacks
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth|api/ebay/callback).*)'],
};
