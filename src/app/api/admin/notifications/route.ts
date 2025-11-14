/**
 * Admin Notifications API
 *
 * Endpoints:
 * - GET /api/admin/notifications - List all notifications
 * - POST /api/admin/notifications - Create new notification
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/admin-auth';
import { notificationService } from '@/services/NotificationService';
import type { AdminNotification } from '@/components/admin/NotificationManagement';

/**
 * GET /api/admin/notifications
 * List all notifications with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user and check admin access
    const authResult = await authenticateAdmin(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const stream = searchParams.get('stream');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Query notifications from database
    let query = supabase
      .from('admin_notifications')
      .select('*', { count: 'exact' });

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    if (type) {
      query = query.eq('type', type);
    }
    if (stream) {
      query = query.contains('target_streams', [stream]);
    }

    // Apply pagination and ordering
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: dbNotifications, error, count } = await query;

    if (error) {
      console.error('Error querying notifications:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch notifications' },
        { status: 500 }
      );
    }

    // Transform database records to AdminNotification format
    const notifications = (dbNotifications || []).map(dbToAdminNotification);

    return NextResponse.json({
      success: true,
      notifications,
      total: count || 0,
      limit,
      offset
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/notifications
 * Create a new notification
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user and check admin access
    const authResult = await authenticateAdmin(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    // Parse request body
    const notification: AdminNotification = await request.json();

    // Validate notification
    const validation = notificationService.validateNotification(notification);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Invalid notification', errors: validation.errors },
        { status: 400 }
      );
    }

    // Prepare database record
    const dbRecord = {
      title: notification.title,
      message: notification.message,
      type: notification.type,
      target_streams: notification.target.streams,
      target_segments: notification.target.userSegments,
      target_states: notification.target.states || null,
      target_cities: notification.target.cities || null,
      target_categories: notification.target.categories || null,
      target_rank_min: notification.target.rankRange?.min || null,
      target_rank_max: notification.target.rankRange?.max || null,
      delivery_type: notification.schedule.deliveryType,
      scheduled_date: notification.schedule.scheduleDate || null,
      scheduled_time: notification.schedule.scheduleTime || null,
      timezone: notification.schedule.timezone,
      recurring_frequency: notification.schedule.recurring?.frequency || null,
      recurring_end_date: notification.schedule.recurring?.endDate || null,
      recurring_days_of_week: notification.schedule.recurring?.daysOfWeek || null,
      expiry_date: notification.schedule.expiryDate || null,
      priority: notification.display.priority,
      show_in_app: notification.display.showInApp,
      show_push: notification.display.showPush,
      show_email: notification.display.showEmail,
      show_desktop: notification.display.showDesktop,
      persistent: notification.display.persistent,
      require_action: notification.display.requireAction,
      auto_close_seconds: notification.display.autoClose || null,
      icon: notification.display.icon || null,
      color: notification.display.color || null,
      image_url: notification.display.image || null,
      primary_action_text: notification.actions?.primary?.text || null,
      primary_action_url: notification.actions?.primary?.url || null,
      primary_action_type: notification.actions?.primary?.type || null,
      secondary_action_text: notification.actions?.secondary?.text || null,
      secondary_action_url: notification.actions?.secondary?.url || null,
      secondary_action_type: notification.actions?.secondary?.type || null,
      template_id: notification.template || null,
      template_variables: notification.variables || {},
      status: 'draft',
      created_by: authResult.userId!
    };

    // Save to database
    const { data: savedNotification, error: saveError } = await supabase
      .from('admin_notifications')
      .insert(dbRecord)
      .select()
      .single();

    if (saveError) {
      console.error('Error saving notification:', saveError);
      return NextResponse.json(
        { error: 'Failed to save notification', details: saveError.message },
        { status: 500 }
      );
    }

    // Convert back to AdminNotification format
    let resultNotification = dbToAdminNotification(savedNotification);

    // If delivery type is immediate, send now
    if (notification.schedule.deliveryType === 'immediate') {
      const result = await notificationService.sendNotification(notification);

      // Update status and stats
      const { error: updateError } = await supabase
        .from('admin_notifications')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          actual_delivered: result.delivered,
          total_viewed: 0,
          total_clicked: 0,
          total_dismissed: 0
        })
        .eq('id', savedNotification.id);

      if (updateError) {
        console.error('Error updating notification status:', updateError);
      }

      resultNotification.status = 'sent';
      resultNotification.stats = {
        delivered: result.delivered,
        viewed: 0,
        clicked: 0,
        dismissed: 0
      };
    }
    // If scheduled, set up scheduling
    else if (notification.schedule.deliveryType === 'scheduled') {
      const scheduled = await notificationService.scheduleNotification(notification);

      if (scheduled) {
        await supabase
          .from('admin_notifications')
          .update({ status: 'scheduled' })
          .eq('id', savedNotification.id);

        resultNotification.status = 'scheduled';
      }
    }

    return NextResponse.json({
      success: true,
      notification: resultNotification
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    return NextResponse.json(
      { error: 'Failed to create notification' },
      { status: 500 }
    );
  }
}

/**
 * Authenticate user and verify admin access
 */
async function authenticateAdmin(request: NextRequest): Promise<{
  success: boolean;
  userId?: string;
  error?: string;
  status?: number;
}> {
  try {
    // Get authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return {
        success: false,
        error: 'Not authenticated - Authorization header required',
        status: 401
      };
    }

    // Extract token
    const token = authHeader.replace('Bearer ', '');

    // Verify token with Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return {
        success: false,
        error: 'Invalid authentication token',
        status: 401
      };
    }

    // Check if user has admin privileges
    const adminCheck = await requireAdmin(user.id);
    if (!adminCheck.allowed) {
      return {
        success: false,
        error: adminCheck.error || 'Admin access required',
        status: 403
      };
    }

    return {
      success: true,
      userId: user.id
    };
  } catch (error) {
    console.error('Auth check error:', error);
    return {
      success: false,
      error: 'Authentication failed',
      status: 500
    };
  }
}

/**
 * Convert database record to AdminNotification format
 */
function dbToAdminNotification(dbRecord: any): AdminNotification {
  return {
    id: dbRecord.id,
    title: dbRecord.title,
    message: dbRecord.message,
    type: dbRecord.type,
    target: {
      streams: dbRecord.target_streams || [],
      userSegments: dbRecord.target_segments || [],
      states: dbRecord.target_states || undefined,
      cities: dbRecord.target_cities || undefined,
      categories: dbRecord.target_categories || undefined,
      rankRange: (dbRecord.target_rank_min || dbRecord.target_rank_max) ? {
        min: dbRecord.target_rank_min,
        max: dbRecord.target_rank_max
      } : undefined
    },
    schedule: {
      deliveryType: dbRecord.delivery_type,
      scheduleDate: dbRecord.scheduled_date ? new Date(dbRecord.scheduled_date) : undefined,
      scheduleTime: dbRecord.scheduled_time || undefined,
      timezone: dbRecord.timezone || 'Asia/Kolkata',
      recurring: dbRecord.recurring_frequency ? {
        frequency: dbRecord.recurring_frequency,
        endDate: dbRecord.recurring_end_date ? new Date(dbRecord.recurring_end_date) : undefined,
        daysOfWeek: dbRecord.recurring_days_of_week || undefined
      } : undefined,
      expiryDate: dbRecord.expiry_date ? new Date(dbRecord.expiry_date) : undefined
    },
    display: {
      priority: dbRecord.priority,
      showInApp: dbRecord.show_in_app,
      showPush: dbRecord.show_push,
      showEmail: dbRecord.show_email,
      showDesktop: dbRecord.show_desktop,
      persistent: dbRecord.persistent,
      requireAction: dbRecord.require_action,
      autoClose: dbRecord.auto_close_seconds || undefined,
      icon: dbRecord.icon || undefined,
      color: dbRecord.color || undefined,
      image: dbRecord.image_url || undefined
    },
    actions: {
      primary: (dbRecord.primary_action_text || dbRecord.primary_action_url) ? {
        text: dbRecord.primary_action_text,
        url: dbRecord.primary_action_url,
        type: dbRecord.primary_action_type
      } : undefined,
      secondary: (dbRecord.secondary_action_text || dbRecord.secondary_action_url) ? {
        text: dbRecord.secondary_action_text,
        url: dbRecord.secondary_action_url,
        type: dbRecord.secondary_action_type
      } : undefined
    },
    createdBy: dbRecord.created_by,
    createdAt: new Date(dbRecord.created_at),
    updatedAt: new Date(dbRecord.updated_at),
    status: dbRecord.status,
    stats: {
      delivered: dbRecord.actual_delivered || 0,
      viewed: dbRecord.total_viewed || 0,
      clicked: dbRecord.total_clicked || 0,
      dismissed: dbRecord.total_dismissed || 0
    },
    template: dbRecord.template_id || undefined,
    variables: dbRecord.template_variables || undefined
  };
}
