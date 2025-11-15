/**
 * Batch ID Resolution API
 * POST /api/resolve-ids - Resolve multiple identifiers to IDs
 *
 * Request Body:
 * {
 *   identifiers: string[],
 *   type: 'college' | 'course' | 'cutoff' | 'state',
 *   options?: {
 *     useCache?: boolean,
 *     fuzzyThreshold?: number
 *   }
 * }
 *
 * Response:
 * {
 *   success: true,
 *   results: {
 *     [identifier]: {
 *       id: string | null,
 *       name: string | null,
 *       method: 'direct' | 'composite' | 'fuzzy' | 'link_table' | 'not_found',
 *       confidence: number
 *     }
 *   },
 *   stats: {
 *     total: number,
 *     resolved: number,
 *     notFound: number
 *   }
 * }
 *
 * Rate Limited: 100 requests/minute per IP
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolveBatchIds, resolveId } from '@/services/id-resolver';
import { standardRateLimit, addRateLimitHeaders } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResult = standardRateLimit.check(request);
  if (!rateLimitResult.success) {
    return addRateLimitHeaders(
      NextResponse.json({ success: false, error: rateLimitResult.error }, { status: 429 }),
      rateLimitResult
    );
  }

  try {
    const body = await request.json();
    const { identifiers, type, options = {} } = body;

    // Validation
    if (!Array.isArray(identifiers) || identifiers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'identifiers must be a non-empty array' },
        { status: 400 }
      );
    }

    if (!['college', 'course', 'cutoff', 'state'].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'type must be college, course, cutoff, or state' },
        { status: 400 }
      );
    }

    if (identifiers.length > 100) {
      return NextResponse.json(
        { success: false, error: 'Maximum 100 identifiers per request' },
        { status: 400 }
      );
    }

    // Resolve IDs
    const resolutionResults = await resolveBatchIds(identifiers, {
      type,
      ...options,
    });

    // Convert Map to object
    const results: Record<string, any> = {};
    for (const [identifier, result] of resolutionResults.entries()) {
      results[identifier] = result;
    }

    // Calculate stats
    const resolved = Array.from(resolutionResults.values()).filter(r => r.id !== null).length;
    const notFound = identifiers.length - resolved;

    const jsonResponse = NextResponse.json({
      success: true,
      results,
      stats: {
        total: identifiers.length,
        resolved,
        notFound,
      },
    });

    return addRateLimitHeaders(jsonResponse, rateLimitResult);
  } catch (error) {
    console.error('Batch ID resolution error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to resolve IDs',
      },
      { status: 500 }
    );
  }
}

// Single ID resolution via GET
export async function GET(request: NextRequest) {
  const rateLimitResult = standardRateLimit.check(request);
  if (!rateLimitResult.success) {
    return addRateLimitHeaders(
      NextResponse.json({ success: false, error: rateLimitResult.error }, { status: 429 }),
      rateLimitResult
    );
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const identifier = searchParams.get('identifier');
    const type = searchParams.get('type') as 'college' | 'course' | 'cutoff' | 'state';
    const fuzzyThreshold = Number(searchParams.get('fuzzyThreshold')) || 0.7;

    if (!identifier || !type) {
      return NextResponse.json(
        { success: false, error: 'identifier and type parameters required' },
        { status: 400 }
      );
    }

    const result = await resolveId(identifier, {
      type,
      fuzzyThreshold,
    });

    const jsonResponse = NextResponse.json({
      success: true,
      result,
    });

    return addRateLimitHeaders(jsonResponse, rateLimitResult);
  } catch (error) {
    console.error('ID resolution error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to resolve ID',
      },
      { status: 500 }
    );
  }
}
