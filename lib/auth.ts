// Edge-runtime compatible auth helpers (no node:crypto).
// Uses WebCrypto (crypto.subtle) which is available in both Edge middleware and API routes.

const DEFAULT_SALT = 'swingbot-v3';

export async function hashPassword(password: string): Promise<string> {
    const salt = process.env.AUTH_SALT || DEFAULT_SALT;
    const data = new TextEncoder().encode(`${password}::${salt}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

export const AUTH_COOKIE_NAME = 'sb_auth';
export const AUTH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

// When APP_PASSWORD is not configured, auth is disabled (useful for local dev).
export function isAuthEnabled(): boolean {
    return !!process.env.APP_PASSWORD && process.env.APP_PASSWORD.length > 0;
}

// Constant-time string comparison to avoid timing attacks
export function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
}
