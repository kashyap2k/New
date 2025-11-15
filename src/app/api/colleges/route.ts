/**
 * Colleges API Route
 * GET /api/colleges - Search and filter colleges
 *
 * Rate Limited: 100 requests/minute per IP
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseDataService } from '@/services/supabase-data-service';
import { standardRateLimit, addRateLimitHeaders } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResult = standardRateLimit.check(request);
  if (!rateLimitResult.success) {
    return addRateLimitHeaders(
      NextResponse.json({ success: false, error: rateLimitResult.error }, { status: 429 }),
      rateLimitResult
    );
  }

  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse filters from query params
    const filters = {
      query: searchParams.get('q') || undefined,
      states: searchParams.get('states')?.split(',').filter(Boolean),
      managementTypes: searchParams.get('management')?.split(',').filter(Boolean) as any,
      niacRating: searchParams.get('rating')?.split(',').filter(Boolean) as any,
      nfrfRankMin: searchParams.get('rankMin') ? Number(searchParams.get('rankMin')) : undefined,
      nfrfRankMax: searchParams.get('rankMax') ? Number(searchParams.get('rankMax')) : undefined,
      latitude: searchParams.get('lat') ? Number(searchParams.get('lat')) : undefined,
      longitude: searchParams.get('lng') ? Number(searchParams.get('lng')) : undefined,
      radiusKm: searchParams.get('radius') ? Number(searchParams.get('radius')) : undefined,
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 50,
      offset: searchParams.get('offset') ? Number(searchParams.get('offset')) : 0
    };

    const service = getSupabaseDataService();
    const result = await service.searchColleges(filters);

    const jsonResponse = NextResponse.json({
      success: true,
      ...result
    });

    return addRateLimitHeaders(jsonResponse, rateLimitResult);
  } catch (error) {
    console.error('Error in colleges API:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch colleges'
      },
      { status: 500 }
    );
  }
}
