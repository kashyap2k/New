/**
 * Real-Time Updates Hook
 * Subscribe to real-time changes in Supabase tables
 *
 * Features:
 * - Subscribe to INSERT, UPDATE, DELETE events
 * - Automatic reconnection
 * - Type-safe event handling
 * - Cleanup on unmount
 *
 * Usage:
 * const status = useRealtime({ table: 'colleges', filter: 'state=eq.Karnataka', onChange: handleChange });
 */

'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type RealtimeEventType = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

export interface RealtimeOptions {
  table: string;
  schema?: string;
  event?: RealtimeEventType;
  filter?: string; // e.g., 'state=eq.Karnataka'
  onInsert?: (payload: any) => void;
  onUpdate?: (payload: any) => void;
  onDelete?: (payload: any) => void;
  onChange?: (payload: any) => void;
}

export interface RealtimeStatus {
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  error?: string;
  subscribed: boolean;
  lastEvent?: {
    type: RealtimeEventType;
    timestamp: Date;
  };
}

/**
 * Subscribe to real-time updates for a specific table
 */
export function useRealtime(options: RealtimeOptions) {
  const [status, setStatus] = useState<RealtimeStatus>({
    status: 'connecting',
    subscribed: false,
  });

  const {
    table,
    schema = 'public',
    event = '*',
    filter,
    onInsert,
    onUpdate,
    onDelete,
    onChange,
  } = options;

  useEffect(() => {
    let channel: RealtimeChannel;

    const setupSubscription = async () => {
      try {
        setStatus(prev => ({ ...prev, status: 'connecting' }));

        // Create channel name
        const channelName = `realtime:${schema}:${table}${filter ? `:${filter}` : ''}`;

        // Create channel
        channel = supabase.channel(channelName);

        // Setup event listeners
        const subscription = channel.on(
          'postgres_changes',
          {
            event,
            schema,
            table,
            filter,
          } as any,
          payload => {
            // Update status
            setStatus(prev => ({
              ...prev,
              lastEvent: {
                type: payload.eventType as RealtimeEventType,
                timestamp: new Date(),
              },
            }));

            // Call specific handlers
            switch (payload.eventType) {
              case 'INSERT':
                onInsert?.(payload);
                break;
              case 'UPDATE':
                onUpdate?.(payload);
                break;
              case 'DELETE':
                onDelete?.(payload);
                break;
            }

            // Call generic onChange handler
            onChange?.(payload);
          }
        );

        // Subscribe and handle status
        subscription.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setStatus(prev => ({
              ...prev,
              status: 'connected',
              subscribed: true,
              error: undefined,
            }));
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            setStatus(prev => ({
              ...prev,
              status: 'error',
              subscribed: false,
              error: `Subscription ${status.toLowerCase()}`,
            }));
          }
        });
      } catch (error) {
        console.error('Realtime subscription error:', error);
        setStatus(prev => ({
          ...prev,
          status: 'error',
          subscribed: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }));
      }
    };

    setupSubscription();

    // Cleanup
    return () => {
      if (channel) {
        supabase.removeChannel(channel);
        setStatus(prev => ({
          ...prev,
          status: 'disconnected',
          subscribed: false,
        }));
      }
    };
  }, [table, schema, event, filter, onInsert, onUpdate, onDelete, onChange]);

  return status;
}

/**
 * Subscribe to changes for a specific college
 */
export function useCollegeRealtime(collegeId: string, onChange: (college: any) => void) {
  return useRealtime({
    table: 'colleges',
    event: 'UPDATE',
    filter: `id=eq.${collegeId}`,
    onUpdate: (payload) => onChange(payload.new),
  });
}

/**
 * Subscribe to changes for a specific course
 */
export function useCourseRealtime(courseId: string, onChange: (course: any) => void) {
  return useRealtime({
    table: 'courses',
    event: 'UPDATE',
    filter: `id=eq.${courseId}`,
    onUpdate: (payload) => onChange(payload.new),
  });
}

/**
 * Subscribe to cutoff updates for a specific college
 */
export function useCutoffRealtime(collegeId: string, onChange: (cutoff: any) => void) {
  return useRealtime({
    table: 'cutoffs',
    event: '*',
    filter: `college_id=eq.${collegeId}`,
    onChange: (payload) => onChange(payload),
  });
}

/**
 * Subscribe to trending colleges (favorites table changes)
 */
export function useTrendingRealtime(onChange: (data: any) => void) {
  return useRealtime({
    table: 'favorites',
    event: 'INSERT',
    onChange: (payload) => onChange(payload),
  });
}

/**
 * Subscribe to admin notifications
 */
export function useAdminNotificationsRealtime(onChange: (notification: any) => void) {
  return useRealtime({
    table: 'admin_notifications',
    event: '*',
    onChange: (payload) => onChange(payload),
  });
}
