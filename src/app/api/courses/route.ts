/**
 * Courses API Route
 * GET /api/courses - Search and filter courses
 *
 * Provides comprehensive course search and filtering capabilities
 * with support for streams, branches, colleges, and more.
 *
 * Rate Limited: 100 requests/minute per IP
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { standardRateLimit, addRateLimitHeaders } from '@/lib/rate-limit';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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

    // Parse search parameters
    const query = searchParams.get('query') || searchParams.get('q') || '';
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 100); // Max 100
    const offset = Number(searchParams.get('offset')) || 0;
    const page = Math.floor(offset / limit) + 1;

    // Parse filters
    const streams = searchParams.get('streams')?.split(',').filter(Boolean);
    const branches = searchParams.get('branches')?.split(',').filter(Boolean);
    const colleges = searchParams.get('colleges')?.split(',').filter(Boolean);
    const degreeTypes = searchParams.get('degreeTypes')?.split(',').filter(Boolean);
    const states = searchParams.get('states')?.split(',').filter(Boolean);
    const managementTypes = searchParams.get('management')?.split(',').filter(Boolean);

    // Parse sorting
    const sortBy = searchParams.get('sortBy') || 'name';
    const sortOrder = searchParams.get('sortOrder') || 'asc';

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Build query
    let queryBuilder = supabase
      .from('courses')
      .select('*', { count: 'exact' });

    // Text search across multiple fields
    if (query.trim()) {
      const searchPattern = `%${query}%`;
      queryBuilder = queryBuilder.or(
        `name.ilike.${searchPattern},college_name.ilike.${searchPattern},branch.ilike.${searchPattern},stream.ilike.${searchPattern}`
      );
    }

    // Multi-select filters
    if (streams && streams.length > 0) {
      queryBuilder = queryBuilder.in('stream', streams);
    }

    if (branches && branches.length > 0) {
      queryBuilder = queryBuilder.in('branch', branches);
    }

    if (colleges && colleges.length > 0) {
      queryBuilder = queryBuilder.in('college_name', colleges);
    }

    if (degreeTypes && degreeTypes.length > 0) {
      queryBuilder = queryBuilder.in('degree_type', degreeTypes);
    }

    // If filtering by state, we need to join with colleges table
    // For now, filter by college_state if that field exists
    if (states && states.length > 0) {
      // This assumes courses table has college_state field
      // If not, we'll need to do a join with colleges table
      queryBuilder = queryBuilder.in('college_state', states);
    }

    // Sorting
    switch (sortBy) {
      case 'name':
        queryBuilder = queryBuilder.order('name', { ascending: sortOrder === 'asc' });
        break;
      case 'college':
        queryBuilder = queryBuilder.order('college_name', { ascending: sortOrder === 'asc' });
        break;
      case 'stream':
        queryBuilder = queryBuilder.order('stream', { ascending: sortOrder === 'asc' });
        break;
      case 'seats':
        queryBuilder = queryBuilder
          .not('total_seats', 'is', null)
          .order('total_seats', { ascending: sortOrder === 'asc' });
        break;
      case 'fees':
        queryBuilder = queryBuilder
          .not('annual_fees', 'is', null)
          .order('annual_fees', { ascending: sortOrder === 'asc' });
        break;
      default:
        queryBuilder = queryBuilder.order('name', { ascending: true });
    }

    // Pagination
    queryBuilder = queryBuilder.range(offset, offset + limit - 1);

    // Execute query
    const { data: courses, error, count } = await queryBuilder;

    if (error) {
      console.error('Courses search error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const totalPages = Math.ceil((count || 0) / limit);

    const jsonResponse = NextResponse.json({
      success: true,
      data: courses || [],
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages,
        hasMore: (offset + limit) < (count || 0),
        hasNext: (offset + limit) < (count || 0),
        hasPrevious: offset > 0,
      },
    });

    return addRateLimitHeaders(jsonResponse, rateLimitResult);

  } catch (error) {
    console.error('Courses API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch courses',
        data: [],
        pagination: {
          total: 0,
          page: 1,
          limit: 50,
          totalPages: 0,
          hasMore: false,
          hasNext: false,
          hasPrevious: false,
        },
      },
      { status: 500 }
    );
  }
}
