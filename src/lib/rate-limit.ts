/**
 * Simple In-Memory Rate Limiter Middleware
 * Protects API routes from abuse without external dependencies
 *
 * Usage:
 * import { rateLimit } from '@/lib/rate-limit';
 * const limiter = rateLimit({ windowMs: 60000, max: 100 });
 * const result = limiter.check(request);
 * if (!result.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
 */

interface RateLimitOptions {
  windowMs?: number;  // Time window in milliseconds (default: 1 minute)
  max?: number;       // Max requests per window (default: 100)
  message?: string;   // Error message
}

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  error?: string;
}

interface RequestRecord {
  count: number;
  resetTime: number;
}

// In-memory store (use Redis in production for multi-instance deployments)
const store = new Map<string, RequestRecord>();

// Cleanup old entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of store.entries()) {
    if (record.resetTime < now) {
      store.delete(key);
    }
  }
}, 10 * 60 * 1000);

/**
 * Get client identifier from request
 */
function getClientId(request: Request): string {
  // Try to get IP from headers (Vercel/Cloudflare)
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');

  const ip = cfConnectingIp || forwarded?.split(',')[0] || realIp || 'unknown';

  // Combine IP with URL for per-endpoint limits
  const url = new URL(request.url);
  return `${ip}:${url.pathname}`;
}

/**
 * Rate limiter factory
 */
export function rateLimit(options: RateLimitOptions = {}) {
  const windowMs = options.windowMs || 60 * 1000; // Default: 1 minute
  const max = options.max || 100; // Default: 100 requests per minute
  const message = options.message || 'Too many requests, please try again later';

  return {
    check: (request: Request): RateLimitResult => {
      const clientId = getClientId(request);
      const now = Date.now();

      let record = store.get(clientId);

      // Initialize or reset if window expired
      if (!record || record.resetTime < now) {
        record = {
          count: 0,
          resetTime: now + windowMs,
        };
        store.set(clientId, record);
      }

      // Increment counter
      record.count++;

      // Check if limit exceeded
      if (record.count > max) {
        return {
          success: false,
          limit: max,
          remaining: 0,
          reset: record.resetTime,
          error: message,
        };
      }

      return {
        success: true,
        limit: max,
        remaining: max - record.count,
        reset: record.resetTime,
      };
    },
  };
}

/**
 * Pre-configured rate limiters for different use cases
 */

// Strict: For sensitive endpoints (login, admin)
export const strictRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: 'Too many attempts, please try again in 15 minutes',
});

// Standard: For regular API endpoints
export const standardRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: 'API rate limit exceeded, please slow down',
});

// Generous: For search and public endpoints
export const generousRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300,
  message: 'Search rate limit exceeded',
});

/**
 * Middleware helper for Next.js API routes
 */
export async function applyRateLimit(
  request: Request,
  limiter: ReturnType<typeof rateLimit> = standardRateLimit
): Promise<RateLimitResult> {
  return limiter.check(request);
}

/**
 * Helper to add rate limit headers to response
 */
export function addRateLimitHeaders(
  response: Response,
  result: RateLimitResult
): Response {
  const headers = new Headers(response.headers);
  headers.set('X-RateLimit-Limit', result.limit.toString());
  headers.set('X-RateLimit-Remaining', result.remaining.toString());
  headers.set('X-RateLimit-Reset', new Date(result.reset).toISOString());

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
