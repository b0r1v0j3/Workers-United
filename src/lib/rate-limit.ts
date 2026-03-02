// ─── Rate Limiter ────────────────────────────────────────────────────────────
// Simple in-memory rate limiter for Vercel Serverless Functions.
// Tracks request counts per IP with sliding window.
//
// Usage:
//   const limiter = rateLimit({ interval: 60_000, limit: 10 });
//   const result = limiter.check(ip);
//   if (!result.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

interface RateLimitOptions {
    interval: number;   // Time window in ms (e.g. 60_000 = 1 minute)
    limit: number;      // Max requests per window
}

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: number;
}

// In-memory store — resets on cold start (fine for serverless)
const stores = new Map<string, Map<string, RateLimitEntry>>();

export function rateLimit(options: RateLimitOptions) {
    const { interval, limit } = options;
    const storeKey = `${interval}-${limit}`;

    if (!stores.has(storeKey)) {
        stores.set(storeKey, new Map());
    }
    const store = stores.get(storeKey)!;

    // Cleanup old entries periodically (prevent memory leak)
    const cleanup = () => {
        const now = Date.now();
        for (const [key, entry] of store) {
            if (entry.resetAt < now) store.delete(key);
        }
    };

    return {
        check(identifier: string): RateLimitResult {
            const now = Date.now();
            const entry = store.get(identifier);

            // Cleanup every ~100 requests
            if (store.size > 100) cleanup();

            if (!entry || entry.resetAt < now) {
                // New window
                store.set(identifier, { count: 1, resetAt: now + interval });
                return { allowed: true, remaining: limit - 1, resetAt: now + interval };
            }

            entry.count++;
            if (entry.count > limit) {
                return { allowed: false, remaining: 0, resetAt: entry.resetAt };
            }

            return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
        },
    };
}

// ─── Pre-configured limiters for different route types ───────────────────────

// Strict: auth, document verification (expensive AI calls)
export const strictLimiter = rateLimit({ interval: 60_000, limit: 10 });

// Standard: regular API routes
export const standardLimiter = rateLimit({ interval: 60_000, limit: 30 });

// Relaxed: public pages, webhooks
export const relaxedLimiter = rateLimit({ interval: 60_000, limit: 100 });

// ─── Helper to get IP from request ──────────────────────────────────────────

export function getClientIP(request: Request): string {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0].trim();
    const real = request.headers.get("x-real-ip");
    if (real) return real;
    return "unknown";
}

// ─── One-liner rate limit check ─────────────────────────────────────────────
// Usage: const blocked = checkRateLimit(request, strictLimiter);
//        if (blocked) return blocked;

import { NextResponse } from "next/server";

export function checkRateLimit(
    request: Request,
    limiter: ReturnType<typeof rateLimit>
): NextResponse | null {
    const ip = getClientIP(request);
    const result = limiter.check(ip);

    if (!result.allowed) {
        return NextResponse.json(
            { error: "Too many requests. Please try again later." },
            {
                status: 429,
                headers: {
                    "Retry-After": String(Math.ceil((result.resetAt - Date.now()) / 1000)),
                    "X-RateLimit-Limit": String(limiter.check("__meta__").remaining + 1),
                    "X-RateLimit-Remaining": "0",
                },
            }
        );
    }

    return null; // Not blocked
}
