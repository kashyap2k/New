/**
 * Statistics API
 * GET /api/stats - Get platform-wide statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get counts for all major entities in parallel
    const [
      collegesCount,
      coursesCount,
      cutoffsCount,
      usersCount,
    ] = await Promise.all([
      supabase.from('colleges').select('*', { count: 'exact', head: true }),
      supabase.from('courses').select('*', { count: 'exact', head: true }),
      supabase.from('cutoffs').select('*', { count: 'exact', head: true }),
      supabase.from('user_profiles').select('*', { count: 'exact', head: true }),
    ]);

    // Calculate additional stats
    const stats = {
      totalColleges: collegesCount.count || 0,
      totalCourses: coursesCount.count || 0,
      totalCutoffs: cutoffsCount.count || 0,
      totalSeatRecords: cutoffsCount.count || 0, // Same as cutoffs for now
      totalUsers: usersCount.count || 0,
      totalDnbAggregations: 0, // This would need a specific query if DNB data exists
    };

    // Get additional insights
    const { data: governmentColleges } = await supabase
      .from('colleges')
      .select('*', { count: 'exact', head: true })
      .eq('management_type', 'Government');

    const { data: privateColleges } = await supabase
      .from('colleges')
      .select('*', { count: 'exact', head: true })
      .eq('management_type', 'Private');

    // Get stream distribution
    const { data: streamData } = await supabase
      .from('colleges')
      .select('stream');

    const streamCounts: Record<string, number> = {};
    streamData?.forEach(item => {
      const stream = item.stream || 'Unknown';
      streamCounts[stream] = (streamCounts[stream] || 0) + 1;
    });

    return NextResponse.json({
      success: true,
      data: {
        ...stats,
        governmentColleges: governmentColleges?.count || 0,
        privateColleges: privateColleges?.count || 0,
        streamDistribution: streamCounts,
        lastUpdated: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('Stats API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch statistics',
        data: {
          totalColleges: 0,
          totalCourses: 0,
          totalCutoffs: 0,
          totalSeatRecords: 0,
          totalUsers: 0,
        },
      },
      { status: 500 }
    );
  }
}
