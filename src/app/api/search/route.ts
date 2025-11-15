/**
 * Unified Search API
 * GET /api/search - Search across colleges, courses, and cutoffs
 *
 * This endpoint provides unified search functionality across all entities,
 * supporting both simple text search and advanced filtering.
 *
 * Rate Limited: 300 requests/minute per IP
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseDataService } from '@/services/supabase-data-service';
import { generousRateLimit, addRateLimitHeaders } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResult = generousRateLimit.check(request);
  if (!rateLimitResult.success) {
    return addRateLimitHeaders(
      NextResponse.json(
        {
          success: false,
          error: rateLimitResult.error,
          colleges: [],
          courses: [],
          cutoffs: [],
          total_results: 0,
        },
        { status: 429 }
      ),
      rateLimitResult
    );
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const startTime = Date.now();

    // Extract search parameters
    const query = searchParams.get('query') || searchParams.get('q') || '';
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 100); // Max 100 for performance
    const offset = Number(searchParams.get('offset')) || 0;

    // Parse filters
    const filters = {
      states: searchParams.get('states')?.split(',').filter(Boolean),
      managementTypes: searchParams.get('management')?.split(',').filter(Boolean) as any,
      streams: searchParams.get('streams')?.split(',').filter(Boolean),
      branches: searchParams.get('branches')?.split(',').filter(Boolean),
      categories: searchParams.get('categories')?.split(',').filter(Boolean),
      year: searchParams.get('year') ? Number(searchParams.get('year')) : undefined,
      nfrfRankMin: searchParams.get('rankMin') ? Number(searchParams.get('rankMin')) : undefined,
      nfrfRankMax: searchParams.get('rankMax') ? Number(searchParams.get('rankMax')) : undefined,
    };

    const service = getSupabaseDataService();

    // Perform parallel searches across all entities
    const [collegesResult, cutoffsResult] = await Promise.all([
      // Search colleges
      service.searchColleges({
        query,
        states: filters.states,
        managementTypes: filters.managementTypes,
        nfrfRankMin: filters.nfrfRankMin,
        nfrfRankMax: filters.nfrfRankMax,
        limit: Math.ceil(limit / 3), // Divide results equally
        offset: 0
      }),

      // Search cutoffs
      service.searchCutoffs({
        collegeQuery: query,
        year: filters.year,
        category: filters.categories?.[0],
        state: filters.states?.[0],
        limit: Math.ceil(limit / 3),
        offset: 0
      })
    ]);

    // For courses, we'll need to query the courses table
    // Since SupabaseDataService doesn't have a searchCourses method yet,
    // we'll add it here as a direct query
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let coursesQuery = supabase
      .from('courses')
      .select('*', { count: 'exact' });

    if (query.trim()) {
      coursesQuery = coursesQuery.or(
        `name.ilike.%${query}%,college_name.ilike.%${query}%,branch.ilike.%${query}%`
      );
    }

    if (filters.streams && filters.streams.length > 0) {
      coursesQuery = coursesQuery.in('stream', filters.streams);
    }

    if (filters.branches && filters.branches.length > 0) {
      coursesQuery = coursesQuery.in('branch', filters.branches);
    }

    coursesQuery = coursesQuery
      .limit(Math.ceil(limit / 3))
      .order('name', { ascending: true });

    const { data: courses, error: coursesError, count: coursesCount } = await coursesQuery;

    if (coursesError) {
      console.error('Courses search error:', coursesError);
    }

    // Calculate search time
    const searchTime = Date.now() - startTime;

    // Generate smart suggestions based on query
    const suggestions = generateSearchSuggestions(query, {
      hasColleges: collegesResult.data.length > 0,
      hasCourses: (courses?.length || 0) > 0,
      hasCutoffs: cutoffsResult.data.length > 0,
    });

    // Combine results
    const response = {
      success: true,
      colleges: collegesResult.data,
      courses: courses || [],
      cutoffs: cutoffsResult.data,
      total_results: collegesResult.count + (coursesCount || 0) + cutoffsResult.count,
      search_time: searchTime,
      suggestions,
      pagination: {
        colleges: {
          total: collegesResult.count,
          showing: collegesResult.data.length,
        },
        courses: {
          total: coursesCount || 0,
          showing: courses?.length || 0,
        },
        cutoffs: {
          total: cutoffsResult.count,
          showing: cutoffsResult.data.length,
        },
      },
    };

    // Add rate limit headers to successful response
    const jsonResponse = NextResponse.json(response);
    return addRateLimitHeaders(jsonResponse, rateLimitResult);

  } catch (error) {
    console.error('Unified search error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Search failed',
        colleges: [],
        courses: [],
        cutoffs: [],
        total_results: 0,
        search_time: 0,
        suggestions: [],
      },
      { status: 500 }
    );
  }
}

/**
 * Generate smart search suggestions based on query and results
 */
function generateSearchSuggestions(
  query: string,
  results: { hasColleges: boolean; hasCourses: boolean; hasCutoffs: boolean }
): string[] {
  const suggestions: string[] = [];
  const queryLower = query.toLowerCase().trim();

  // If no query, provide popular suggestions
  if (!queryLower) {
    return [
      'AIIMS Delhi',
      'Government medical colleges',
      'MBBS courses',
      'NEET cutoffs 2024',
      'Dental colleges',
    ];
  }

  // Contextual suggestions based on what was found
  if (results.hasColleges && !results.hasCourses) {
    suggestions.push(`${query} MBBS`, `${query} BDS`);
  }

  if (results.hasCourses && !results.hasColleges) {
    suggestions.push(`${query} colleges`, `${query} admission`);
  }

  if (results.hasCutoffs) {
    suggestions.push(`${query} previous year cutoffs`, `${query} rank predictor`);
  }

  // Medical education specific suggestions
  const commonTerms = {
    'aiims': ['AIIMS Delhi MBBS', 'AIIMS entrance exam', 'AIIMS cutoff'],
    'neet': ['NEET cutoff', 'NEET rank predictor', 'NEET counselling'],
    'mbbs': ['MBBS colleges', 'MBBS fees', 'MBBS admission'],
    'bds': ['BDS colleges', 'Dental admission', 'BDS cutoffs'],
    'government': ['Government medical colleges', 'State quota colleges'],
    'private': ['Private medical colleges', 'Management quota'],
    'delhi': ['Medical colleges in Delhi', 'AIIMS Delhi', 'Delhi quota'],
    'mumbai': ['Medical colleges in Mumbai', 'Mumbai quota'],
    'bangalore': ['Medical colleges in Bangalore', 'Karnataka quota'],
  };

  // Add relevant suggestions based on query
  for (const [key, suggestionList] of Object.entries(commonTerms)) {
    if (queryLower.includes(key)) {
      suggestions.push(...suggestionList.slice(0, 2));
      break;
    }
  }

  // Generic helpful suggestions
  if (suggestions.length === 0) {
    suggestions.push(
      `${query} colleges`,
      `${query} cutoffs`,
      `${query} admission process`,
      `${query} fees structure`
    );
  }

  // Return unique suggestions, limit to 5
  return [...new Set(suggestions)].slice(0, 5);
}
