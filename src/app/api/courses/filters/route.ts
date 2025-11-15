/**
 * Courses Filters API
 * GET /api/courses/filters - Get available filter options for courses
 *
 * Returns all unique values for filtering courses:
 * - Streams (Medical, Dental, Ayurveda, etc.)
 * - Branches (MBBS, BDS, MD, MS, etc.)
 * - Degree Types (UG, PG, Diploma, etc.)
 * - Colleges (all colleges offering courses)
 * - States (derived from colleges)
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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch distinct values for all filter fields
    const [
      streamsResult,
      branchesResult,
      degreeTypesResult,
      collegesResult,
      statesResult
    ] = await Promise.all([
      // Get all unique streams
      supabase
        .from('courses')
        .select('stream')
        .not('stream', 'is', null)
        .order('stream'),

      // Get all unique branches
      supabase
        .from('courses')
        .select('branch')
        .not('branch', 'is', null)
        .order('branch'),

      // Get all unique degree types
      supabase
        .from('courses')
        .select('degree_type')
        .not('degree_type', 'is', null)
        .order('degree_type'),

      // Get all unique colleges
      supabase
        .from('courses')
        .select('college_name, college_id')
        .not('college_name', 'is', null)
        .order('college_name'),

      // Get states from colleges table
      supabase
        .from('colleges')
        .select('state')
        .not('state', 'is', null)
        .order('state'),
    ]);

    // Extract unique values
    const streams = [...new Set(
      streamsResult.data?.map(item => item.stream).filter(Boolean) || []
    )];

    const branches = [...new Set(
      branchesResult.data?.map(item => item.branch).filter(Boolean) || []
    )];

    const degreeTypes = [...new Set(
      degreeTypesResult.data?.map(item => item.degree_type).filter(Boolean) || []
    )];

    // For colleges, keep unique by college_name
    const collegesMap = new Map();
    collegesResult.data?.forEach(item => {
      if (item.college_name && !collegesMap.has(item.college_name)) {
        collegesMap.set(item.college_name, {
          id: item.college_id,
          name: item.college_name
        });
      }
    });
    const colleges = Array.from(collegesMap.values());

    const states = [...new Set(
      statesResult.data?.map(item => item.state).filter(Boolean) || []
    )];

    // Get counts for each filter option
    const filterCounts = await getFilterCounts(supabase, {
      streams,
      branches,
      degreeTypes,
      states,
    });

    const jsonResponse = NextResponse.json({
      success: true,
      data: {
        streams: streams.map(stream => ({
          value: stream,
          label: stream,
          count: filterCounts.streams[stream] || 0,
        })),
        branches: branches.map(branch => ({
          value: branch,
          label: branch,
          count: filterCounts.branches[branch] || 0,
        })),
        degreeTypes: degreeTypes.map(type => ({
          value: type,
          label: type,
          count: filterCounts.degreeTypes[type] || 0,
        })),
        colleges: colleges.map(college => ({
          value: college.name,
          label: college.name,
          id: college.id,
        })),
        states: states.map(state => ({
          value: state,
          label: state,
          count: filterCounts.states[state] || 0,
        })),
      },
    });

    return addRateLimitHeaders(jsonResponse, rateLimitResult);

  } catch (error) {
    console.error('Courses filters API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch filters',
        data: {
          streams: [],
          branches: [],
          degreeTypes: [],
          colleges: [],
          states: [],
        },
      },
      { status: 500 }
    );
  }
}

/**
 * Get counts for each filter option
 * This helps users know how many results each filter will return
 */
async function getFilterCounts(
  supabase: any,
  filters: {
    streams: string[];
    branches: string[];
    degreeTypes: string[];
    states: string[];
  }
) {
  const counts = {
    streams: {} as Record<string, number>,
    branches: {} as Record<string, number>,
    degreeTypes: {} as Record<string, number>,
    states: {} as Record<string, number>,
  };

  // Count courses for each stream
  for (const stream of filters.streams) {
    const { count } = await supabase
      .from('courses')
      .select('*', { count: 'exact', head: true })
      .eq('stream', stream);
    counts.streams[stream] = count || 0;
  }

  // Count courses for each branch
  for (const branch of filters.branches) {
    const { count } = await supabase
      .from('courses')
      .select('*', { count: 'exact', head: true })
      .eq('branch', branch);
    counts.branches[branch] = count || 0;
  }

  // Count courses for each degree type
  for (const degreeType of filters.degreeTypes) {
    const { count } = await supabase
      .from('courses')
      .select('*', { count: 'exact', head: true })
      .eq('degree_type', degreeType);
    counts.degreeTypes[degreeType] = count || 0;
  }

  // Count colleges in each state
  for (const state of filters.states) {
    const { count } = await supabase
      .from('colleges')
      .select('*', { count: 'exact', head: true })
      .eq('state', state);
    counts.states[state] = count || 0;
  }

  return counts;
}
