import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, timingSafeEqual, AUTH_COOKIE_NAME, isAuthEnabled } from '@/lib/auth';

// Paths that never require auth
const PUBLIC_PREFIXES = [
    '/login',
    '/api/auth',
    '/_next',
    '/favicon.ico',
    '/icons',
    '/images',
];

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // Skip auth when APP_PASSWORD is not configured (local dev)
    if (!isAuthEnabled()) return NextResponse.next();

    // Allow public paths
    if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) {
        return NextResponse.next();
    }

    const token = req.cookies.get(AUTH_COOKIE_NAME)?.value ?? '';
    const expected = await hashPassword(process.env.APP_PASSWORD!);

    if (!timingSafeEqual(token, expected)) {
        // API routes → 401 JSON
        if (pathname.startsWith('/api/')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        // Pages → redirect to /login
        const loginUrl = req.nextUrl.clone();
        loginUrl.pathname = '/login';
        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
}

export const config = {
    // Run on all paths except Next.js internals and static files
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
