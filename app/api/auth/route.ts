import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, AUTH_COOKIE_NAME, AUTH_COOKIE_MAX_AGE, isAuthEnabled, timingSafeEqual } from '@/lib/auth';

// POST /api/auth  →  verify password, set httpOnly cookie
export async function POST(req: NextRequest) {
    if (!isAuthEnabled()) {
        return NextResponse.json({ ok: true, message: 'Auth disabled' });
    }

    const { password } = await req.json().catch(() => ({ password: '' }));

    if (!password || typeof password !== 'string') {
        return NextResponse.json({ error: 'Password required' }, { status: 400 });
    }

    const inputHash = await hashPassword(password);
    const expectedHash = await hashPassword(process.env.APP_PASSWORD!);

    if (!timingSafeEqual(inputHash, expectedHash)) {
        // Short delay to slow down brute-force attempts
        await new Promise(r => setTimeout(r, 500));
        return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set(AUTH_COOKIE_NAME, expectedHash, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: AUTH_COOKIE_MAX_AGE,
        path: '/',
    });
    return res;
}

// DELETE /api/auth  →  logout (clear cookie)
export async function DELETE() {
    const res = NextResponse.json({ ok: true });
    res.cookies.set(AUTH_COOKIE_NAME, '', {
        httpOnly: true,
        maxAge: 0,
        path: '/',
    });
    return res;
}
