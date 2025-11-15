/**
 * Analytics API
 * GET /api/analytics - Get platform analytics and statistics
 *
 * Provides real-time analytics data from Supabase including:
 * - System metrics
 * - User analytics
 * - Performance metrics
 * - Search analytics
 *
 * Rate Limited: 100 requests/minute per IP
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
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
    const dateRange = searchParams.get('range') || '7d'; // 7d, 30d, 90d
    const startTime = Date.now();

    // Calculate date range
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch all analytics data in parallel
    const [
      collegesCount,
      coursesCount,
      cutoffsCount,
      usersCount,
      recentUsers,
      collegesByState,
      coursesByStream,
      popularColleges,
    ] = await Promise.all([
      // Total counts
      supabase.from('colleges').select('*', { count: 'exact', head: true }),
      supabase.from('courses').select('*', { count: 'exact', head: true }),
      supabase.from('cutoffs').select('*', { count: 'exact', head: true }),
      supabase.from('user_profiles').select('*', { count: 'exact', head: true }),

      // Recent user signups (last N days)
      supabase
        .from('user_profiles')
        .select('created_at')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false }),

      // College distribution by state
      supabase
        .from('colleges')
        .select('state')
        .limit(1000),

      // Course distribution by stream
      supabase
        .from('courses')
        .select('stream')
        .limit(1000),

      // Popular colleges (by favorites count if available)
      supabase
        .from('favorites')
        .select('college_id')
        .limit(1000),
    ]);

    // Calculate user growth data
    const userGrowthData = calculateUserGrowth(recentUsers.data || [], days);

    // Calculate distribution metrics
    const stateDistribution = calculateDistribution(
      collegesByState.data?.map((c: any) => c.state).filter(Boolean) || []
    );

    const streamDistribution = calculateDistribution(
      coursesByStream.data?.map((c: any) => c.stream).filter(Boolean) || []
    );

    // Calculate popular colleges
    const collegePopularity = calculateDistribution(
      popularColleges.data?.map((f: any) => f.college_id).filter(Boolean) || []
    );

    const popularCollegeIds = Object.entries(collegePopularity)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 5)
      .map(([id]) => id);

    // Get top college names
    let topColleges: any[] = [];
    if (popularCollegeIds.length > 0) {
      const { data } = await supabase
        .from('colleges')
        .select('id, name')
        .in('id', popularCollegeIds);
      topColleges = data || [];
    }

    // Calculate response time
    const responseTime = Date.now() - startTime;

    // Build analytics response
    const analytics = {
      success: true,
      dateRange,
      days,
      timestamp: new Date().toISOString(),

      // Platform metrics
      platformMetrics: {
        totalColleges: collegesCount.count || 0,
        totalCourses: coursesCount.count || 0,
        totalCutoffs: cutoffsCount.count || 0,
        totalUsers: usersCount.count || 0,
      },

      // User analytics
      userAnalytics: {
        totalUsers: usersCount.count || 0,
        newUsers: recentUsers.data?.length || 0,
        growthData: userGrowthData,
        growthPercentage: calculateGrowthPercentage(userGrowthData),
      },

      // Content distribution
      distribution: {
        byState: Object.entries(stateDistribution)
          .sort(([, a], [, b]) => (b as number) - (a as number))
          .slice(0, 10)
          .map(([state, count]) => ({
            state,
            count,
            percentage: ((count as number) / (collegesByState.data?.length || 1)) * 100,
          })),
        byStream: Object.entries(streamDistribution)
          .sort(([, a], [, b]) => (b as number) - (a as number))
          .slice(0, 10)
          .map(([stream, count]) => ({
            stream,
            count,
            percentage: ((count as number) / (coursesByStream.data?.length || 1)) * 100,
          })),
      },

      // Popular content
      popular: {
        colleges: topColleges.map((college) => ({
          id: college.id,
          name: college.name,
          favorites: collegePopularity[college.id] || 0,
        })),
      },

      // Performance
      performance: {
        responseTime,
        dataPoints: {
          colleges: collegesCount.count || 0,
          courses: coursesCount.count || 0,
          cutoffs: cutoffsCount.count || 0,
        },
      },
    };

    const jsonResponse = NextResponse.json(analytics);
    return addRateLimitHeaders(jsonResponse, rateLimitResult);
  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch analytics',
      },
      { status: 500 }
    );
  }
}

/**
 * Calculate user growth data by day
 */
function calculateUserGrowth(users: Array<{ created_at: string }>, days: number) {
  const growthData: Array<{ date: string; count: number }> = [];
  const usersByDate: Record<string, number> = {};

  // Count users by date
  users.forEach((user) => {
    const date = new Date(user.created_at).toISOString().split('T')[0];
    usersByDate[date] = (usersByDate[date] || 0) + 1;
  });

  // Fill in all days (including days with 0 users)
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    growthData.push({
      date: dateStr,
      count: usersByDate[dateStr] || 0,
    });
  }

  return growthData;
}

/**
 * Calculate distribution of values
 */
function calculateDistribution(values: string[]): Record<string, number> {
  const distribution: Record<string, number> = {};
  values.forEach((value) => {
    distribution[value] = (distribution[value] || 0) + 1;
  });
  return distribution;
}

/**
 * Calculate growth percentage
 */
function calculateGrowthPercentage(growthData: Array<{ date: string; count: number }>): number {
  if (growthData.length < 2) return 0;

  const firstHalf = growthData.slice(0, Math.floor(growthData.length / 2));
  const secondHalf = growthData.slice(Math.floor(growthData.length / 2));

  const firstHalfTotal = firstHalf.reduce((sum, day) => sum + day.count, 0);
  const secondHalfTotal = secondHalf.reduce((sum, day) => sum + day.count, 0);

  if (firstHalfTotal === 0) return secondHalfTotal > 0 ? 100 : 0;

  return ((secondHalfTotal - firstHalfTotal) / firstHalfTotal) * 100;
}
