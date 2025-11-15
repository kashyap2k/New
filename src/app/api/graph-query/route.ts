/**
 * Graph Query API
 * GET /api/graph-query - Execute cross-referenced graph queries
 *
 * Query Parameters:
 * - stateId: Filter by state ID
 * - courseId: Filter by course ID
 * - collegeId: Filter by college ID
 * - stream: Filter by stream (Medical, Dental, etc.)
 *
 * Examples:
 * - /api/graph-query?stateId=KA&stream=Medical
 *   → Get all medical colleges in Karnataka
 *
 * - /api/graph-query?courseId=CRS0035
 *   → Get all colleges offering this course
 *
 * - /api/graph-query?stateId=DL&courseId=MBBS
 *   → Get all colleges in Delhi offering MBBS
 *
 * Response:
 * {
 *   success: true,
 *   results: {
 *     colleges: Array<College>,
 *     courses: Array<Course>,
 *     states: Array<State>
 *   },
 *   stats: {
 *     totalColleges: number,
 *     totalCourses: number,
 *     totalStates: number
 *   },
 *   query: { ... }
 * }
 *
 * Rate Limited: 100 requests/minute per IP
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getCrossReferencedEntities,
  getCollegesOfferingCourse,
  getCoursesInState,
} from '@/services/relationship-service';
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

    // Parse filters
    const filters = {
      stateId: searchParams.get('stateId') || undefined,
      courseId: searchParams.get('courseId') || undefined,
      collegeId: searchParams.get('collegeId') || undefined,
      stream: searchParams.get('stream') || undefined,
    };

    // Validate at least one filter is provided
    if (!filters.stateId && !filters.courseId && !filters.collegeId && !filters.stream) {
      return NextResponse.json(
        {
          success: false,
          error: 'At least one filter parameter required (stateId, courseId, collegeId, or stream)',
        },
        { status: 400 }
      );
    }

    // Execute cross-referenced query
    const results = await getCrossReferencedEntities(filters);

    // Calculate stats
    const stats = {
      totalColleges: results.colleges.length,
      totalCourses: results.courses.length,
      totalStates: results.states.length,
      totalResults:
        results.colleges.length + results.courses.length + results.states.length,
    };

    const jsonResponse = NextResponse.json({
      success: true,
      results,
      stats,
      query: filters,
    });

    return addRateLimitHeaders(jsonResponse, rateLimitResult);
  } catch (error) {
    console.error('Graph query error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute graph query',
      },
      { status: 500 }
    );
  }
}
