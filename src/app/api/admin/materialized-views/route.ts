/**
 * Materialized Views Management API
 * POST /api/admin/materialized-views/refresh - Refresh all or specific materialized views
 * GET /api/admin/materialized-views - List all materialized views with metadata
 *
 * Admin-only endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function isAdmin(request: NextRequest): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return false;

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', session.user.id)
    .single();

  return profile?.role === 'admin' || profile?.role === 'super_admin';
}

/**
 * GET - List all materialized views
 */
export async function GET(request: NextRequest) {
  try {
    if (!(await isAdmin(request))) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Get list of materialized views
    const views = [
      {
        name: 'mv_college_course_details',
        description: 'College-course relationships with cutoff data',
        estimatedRows: '10,000-50,000',
      },
      {
        name: 'mv_state_college_summary',
        description: 'State-wise college statistics',
        estimatedRows: '30-50',
      },
      {
        name: 'mv_course_availability',
        description: 'Course availability matrix',
        estimatedRows: '5,000-15,000',
      },
      {
        name: 'mv_trending_colleges',
        description: 'Trending colleges (last 30 days)',
        estimatedRows: '50-200',
      },
      {
        name: 'mv_cutoff_trends',
        description: 'Cutoff trend analysis',
        estimatedRows: '10,000-30,000',
      },
    ];

    // Try to get freshness data from each view
    const viewsWithMetadata = await Promise.all(
      views.map(async view => {
        try {
          const { data, error } = await supabase
            .from(view.name)
            .select('last_refreshed')
            .limit(1)
            .single();

          return {
            ...view,
            lastRefreshed: data?.last_refreshed || null,
            status: error ? 'not_created' : 'active',
          };
        } catch (error) {
          return {
            ...view,
            lastRefreshed: null,
            status: 'not_created',
          };
        }
      })
    );

    return NextResponse.json({
      success: true,
      views: viewsWithMetadata,
      totalViews: views.length,
    });
  } catch (error) {
    console.error('List materialized views error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list views',
      },
      { status: 500 }
    );
  }
}

/**
 * POST - Refresh materialized views
 */
export async function POST(request: NextRequest) {
  try {
    if (!(await isAdmin(request))) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { viewName, refreshAll = false } = body;

    if (!refreshAll && !viewName) {
      return NextResponse.json(
        { success: false, error: 'viewName required unless refreshAll=true' },
        { status: 400 }
      );
    }

    const startTime = Date.now();

    if (refreshAll) {
      // Refresh all materialized views
      const { error } = await supabase.rpc('refresh_all_materialized_views');

      if (error) {
        throw new Error(`Failed to refresh all views: ${error.message}`);
      }

      const duration = Date.now() - startTime;

      return NextResponse.json({
        success: true,
        refreshed: 'all',
        viewsRefreshed: 5,
        duration: `${duration}ms`,
        message: 'All materialized views refreshed successfully',
      });
    } else {
      // Refresh specific view
      const { error } = await supabase.rpc('refresh_materialized_view', {
        view_name: viewName,
      });

      if (error) {
        throw new Error(`Failed to refresh view ${viewName}: ${error.message}`);
      }

      const duration = Date.now() - startTime;

      return NextResponse.json({
        success: true,
        refreshed: viewName,
        duration: `${duration}ms`,
        message: `View ${viewName} refreshed successfully`,
      });
    }
  } catch (error) {
    console.error('Refresh materialized views error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to refresh views',
      },
      { status: 500 }
    );
  }
}
