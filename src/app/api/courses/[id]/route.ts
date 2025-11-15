/**
 * Single Course API
 * GET /api/courses/[id] - Get a specific course by ID
 * Enhanced with ID resolution and relationship graph
 *
 * Query Parameters:
 * - includeGraph: Include relationship graph (default: true)
 * - graphDepth: Graph traversal depth 1-3 (default: 1)
 *
 * Rate Limited: 100 requests/minute per IP
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseDataService } from '@/services/supabase-data-service';
import { standardRateLimit, addRateLimitHeaders } from '@/lib/rate-limit';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Apply rate limiting
  const rateLimitResult = standardRateLimit.check(request);
  if (!rateLimitResult.success) {
    return addRateLimitHeaders(
      NextResponse.json({ success: false, error: rateLimitResult.error }, { status: 429 }),
      rateLimitResult
    );
  }

  try {
    const { id } = params;
    const searchParams = request.nextUrl.searchParams;

    // Parse query parameters
    const includeGraph = searchParams.get('includeGraph') !== 'false';
    const graphDepth = Math.min(
      Math.max(Number(searchParams.get('graphDepth')) || 1, 1),
      3
    );

    const service = getSupabaseDataService();
    const result = await service.getCourseDetails(id, {
      includeGraph,
      graphDepth,
    });

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Course not found' },
        { status: 404 }
      );
    }

    const jsonResponse = NextResponse.json({
      success: true,
      ...result,
    });

    return addRateLimitHeaders(jsonResponse, rateLimitResult);

  } catch (error) {
    console.error('Course API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch course',
      },
      { status: 500 }
    );
  }
}
