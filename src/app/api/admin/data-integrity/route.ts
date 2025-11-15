/**
 * Admin Data Integrity API
 * GET /api/admin/data-integrity - Run integrity checks and view issues
 * POST /api/admin/data-integrity - Auto-repair issues
 *
 * Admin-only endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  runIntegrityCheck,
  autoRepairIssues,
  getEntityHealthScore,
  IntegrityIssue,
} from '@/services/data-integrity';
import { supabase } from '@/lib/supabase';
import { standardRateLimit, addRateLimitHeaders } from '@/lib/rate-limit';

/**
 * Check if user is admin
 */
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
 * GET - Run integrity checks
 */
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
    // Check admin authorization
    if (!(await isAdmin(request))) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;

    // Parse query parameters
    const checkMismatches = searchParams.get('checkMismatches') !== 'false';
    const checkOrphans = searchParams.get('checkOrphans') !== 'false';
    const checkDuplicates = searchParams.get('checkDuplicates') !== 'false';
    const checkLinks = searchParams.get('checkLinks') !== 'false';
    const sampleSize = Number(searchParams.get('sampleSize')) || 1000;

    // Run integrity check
    const report = await runIntegrityCheck({
      checkMismatches,
      checkOrphans,
      checkDuplicates,
      checkLinks,
      sampleSize,
    });

    // Calculate summary statistics
    const summary = {
      totalIssues: report.issues.length,
      criticalIssues: report.issues.filter(i => i.severity === 'critical').length,
      highIssues: report.issues.filter(i => i.severity === 'high').length,
      mediumIssues: report.issues.filter(i => i.severity === 'medium').length,
      lowIssues: report.issues.filter(i => i.severity === 'low').length,
      issuesByType: {
        mismatch: report.issues.filter(i => i.type === 'mismatch').length,
        missing: report.issues.filter(i => i.type === 'missing').length,
        orphan: report.issues.filter(i => i.type === 'orphan').length,
        duplicate: report.issues.filter(i => i.type === 'duplicate').length,
      },
      healthScore: report.healthScore,
      autoRepairableCount: report.autoRepairableCount,
    };

    const jsonResponse = NextResponse.json({
      success: true,
      report: {
        ...report,
        summary,
      },
      executedChecks: {
        mismatches: checkMismatches,
        orphans: checkOrphans,
        duplicates: checkDuplicates,
        links: checkLinks,
        sampleSize,
      },
    });

    return addRateLimitHeaders(jsonResponse, rateLimitResult);
  } catch (error) {
    console.error('Data integrity check error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to run integrity check',
      },
      { status: 500 }
    );
  }
}

/**
 * POST - Auto-repair issues
 */
export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResult = standardRateLimit.check(request);
  if (!rateLimitResult.success) {
    return addRateLimitHeaders(
      NextResponse.json({ success: false, error: rateLimitResult.error }, { status: 429 }),
      rateLimitResult
    );
  }

  try {
    // Check admin authorization
    if (!(await isAdmin(request))) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { issues, dryRun = true } = body;

    // Validation
    if (!Array.isArray(issues)) {
      return NextResponse.json(
        { success: false, error: 'Issues array is required' },
        { status: 400 }
      );
    }

    // Run auto-repair
    const result = await autoRepairIssues(issues as IntegrityIssue[], dryRun);

    const jsonResponse = NextResponse.json({
      success: true,
      result,
      dryRun,
      message: dryRun
        ? 'Dry run completed. No changes made. Set dryRun=false to apply fixes.'
        : 'Repairs applied successfully.',
    });

    return addRateLimitHeaders(jsonResponse, rateLimitResult);
  } catch (error) {
    console.error('Auto-repair error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to repair issues',
      },
      { status: 500 }
    );
  }
}
