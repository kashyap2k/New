/**
 * College Details API Route
 * GET /api/colleges/[id] - Get college details with courses, cutoffs, stats
 * Enhanced with ID resolution and relationship graph
 *
 * Query Parameters:
 * - includeGraph: Include relationship graph (default: true)
 * - graphDepth: Graph traversal depth 1-3 (default: 1)
 *
 * The [id] parameter now supports:
 * - UUID (e.g., "550e8400-e29b-41d4-a716-446655440000")
 * - College name (e.g., "A J INSTITUTE OF MEDICAL SCIENCES")
 * - Partial name (e.g., "A J Institute") - uses fuzzy matching
 *
 * Rate Limited: 100 requests/minute per IP
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseDataService } from '@/services/supabase-data-service';
import { supabase } from '@/lib/supabase';
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
    const collegeId = params.id;
    const searchParams = request.nextUrl.searchParams;

    // Parse query parameters
    const includeGraph = searchParams.get('includeGraph') !== 'false';
    const graphDepth = Math.min(
      Math.max(Number(searchParams.get('graphDepth')) || 1, 1),
      3
    );

    // Get user ID from session (if authenticated)
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;

    const service = getSupabaseDataService();
    const result = await service.getCollegeDetails(collegeId, userId, {
      includeGraph,
      graphDepth,
    });

    if (!result) {
      return NextResponse.json(
        {
          success: false,
          error: 'College not found'
        },
        { status: 404 }
      );
    }

    const jsonResponse = NextResponse.json({
      success: true,
      ...result
    });

    return addRateLimitHeaders(jsonResponse, rateLimitResult);
  } catch (error) {
    console.error('Error fetching college details:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch college details'
      },
      { status: 500 }
    );
  }
}
