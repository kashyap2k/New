/**
 * Health Score API
 * GET /api/admin/data-integrity/health?type=college&id=xxx - Get entity health score
 *
 * Returns a 0-100 health score for a specific entity
 */

import { NextRequest, NextResponse } from 'next/server';
import { getEntityHealthScore } from '@/services/data-integrity';
import { supabase } from '@/lib/supabase';

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

export async function GET(request: NextRequest) {
  try {
    if (!(await isAdmin(request))) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');
    const id = searchParams.get('id');

    if (!type || !id) {
      return NextResponse.json(
        { success: false, error: 'type and id parameters required' },
        { status: 400 }
      );
    }

    if (!['college', 'course'].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'type must be "college" or "course"' },
        { status: 400 }
      );
    }

    const healthScore = await getEntityHealthScore(id, type as 'college' | 'course');

    return NextResponse.json({
      success: true,
      entity: { type, id },
      healthScore,
      rating: healthScore >= 90 ? 'Excellent' :
              healthScore >= 75 ? 'Good' :
              healthScore >= 50 ? 'Fair' :
              healthScore >= 25 ? 'Poor' : 'Critical',
    });
  } catch (error) {
    console.error('Health score error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get health score',
      },
      { status: 500 }
    );
  }
}
