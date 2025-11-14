-- =====================================================
-- ADMIN NOTIFICATION MANAGEMENT SYSTEM
-- =====================================================

-- Admin notification templates/campaigns
CREATE TABLE IF NOT EXISTS admin_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Content
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'announcement', 'cutoff_update', 'college_update',
    'deadline', 'feature', 'maintenance', 'alert',
    'success', 'info', 'warning', 'error'
  )),

  -- Targeting
  target_streams TEXT[] NOT NULL DEFAULT ARRAY['ALL']::TEXT[],
  target_segments TEXT[] NOT NULL DEFAULT ARRAY['all_users']::TEXT[],
  target_states TEXT[],
  target_cities TEXT[],
  target_categories TEXT[],
  target_rank_min INTEGER,
  target_rank_max INTEGER,

  -- Scheduling
  delivery_type TEXT NOT NULL CHECK (delivery_type IN ('immediate', 'scheduled')),
  scheduled_date TIMESTAMPTZ,
  scheduled_time TIME,
  timezone TEXT DEFAULT 'Asia/Kolkata',

  -- Recurring options
  recurring_frequency TEXT CHECK (recurring_frequency IN ('daily', 'weekly', 'monthly')),
  recurring_end_date TIMESTAMPTZ,
  recurring_days_of_week INTEGER[],
  expiry_date TIMESTAMPTZ,

  -- Display settings
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  show_in_app BOOLEAN DEFAULT true,
  show_push BOOLEAN DEFAULT false,
  show_email BOOLEAN DEFAULT false,
  show_desktop BOOLEAN DEFAULT false,
  persistent BOOLEAN DEFAULT false,
  require_action BOOLEAN DEFAULT false,
  auto_close_seconds INTEGER,
  icon TEXT,
  color TEXT,
  image_url TEXT,

  -- Actions
  primary_action_text TEXT,
  primary_action_url TEXT,
  primary_action_type TEXT CHECK (primary_action_type IN ('link', 'button', 'modal')),
  secondary_action_text TEXT,
  secondary_action_url TEXT,
  secondary_action_type TEXT CHECK (secondary_action_type IN ('link', 'button', 'modal')),

  -- Template support
  template_id UUID,
  template_variables JSONB DEFAULT '{}',

  -- Status & metadata
  status TEXT NOT NULL CHECK (status IN ('draft', 'scheduled', 'sent', 'cancelled')) DEFAULT 'draft',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,

  -- Stats (updated after delivery)
  estimated_reach INTEGER DEFAULT 0,
  actual_delivered INTEGER DEFAULT 0,
  total_viewed INTEGER DEFAULT 0,
  total_clicked INTEGER DEFAULT 0,
  total_dismissed INTEGER DEFAULT 0
);

-- Index for common queries
CREATE INDEX idx_admin_notifications_status ON admin_notifications(status);
CREATE INDEX idx_admin_notifications_created_by ON admin_notifications(created_by);
CREATE INDEX idx_admin_notifications_scheduled_date ON admin_notifications(scheduled_date) WHERE status = 'scheduled';

-- =====================================================
-- NOTIFICATION DELIVERY TRACKING
-- =====================================================

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  admin_notification_id UUID NOT NULL REFERENCES admin_notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Delivery channels
  delivered_in_app BOOLEAN DEFAULT false,
  delivered_push BOOLEAN DEFAULT false,
  delivered_email BOOLEAN DEFAULT false,
  delivered_desktop BOOLEAN DEFAULT false,

  -- Engagement tracking
  viewed_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,

  -- Delivery metadata
  delivered_at TIMESTAMPTZ DEFAULT NOW(),
  delivery_status TEXT CHECK (delivery_status IN ('pending', 'delivered', 'failed')) DEFAULT 'delivered',
  failure_reason TEXT,

  -- Device/platform info
  device_type TEXT,
  platform TEXT,
  user_agent TEXT,

  CONSTRAINT unique_notification_user UNIQUE (admin_notification_id, user_id)
);

-- Indexes for analytics queries
CREATE INDEX idx_notification_deliveries_admin_notification ON notification_deliveries(admin_notification_id);
CREATE INDEX idx_notification_deliveries_user ON notification_deliveries(user_id);
CREATE INDEX idx_notification_deliveries_viewed ON notification_deliveries(viewed_at) WHERE viewed_at IS NOT NULL;
CREATE INDEX idx_notification_deliveries_clicked ON notification_deliveries(clicked_at) WHERE clicked_at IS NOT NULL;

-- =====================================================
-- NOTIFICATION TEMPLATES
-- =====================================================

CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,

  -- Template content with variables
  title_template TEXT NOT NULL,
  message_template TEXT NOT NULL,

  -- Default settings
  default_type TEXT,
  default_priority TEXT,
  default_settings JSONB DEFAULT '{}',

  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  usage_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to get notification reach estimate
CREATE OR REPLACE FUNCTION estimate_notification_reach(
  p_streams TEXT[],
  p_segments TEXT[],
  p_states TEXT[] DEFAULT NULL,
  p_categories TEXT[] DEFAULT NULL,
  p_rank_min INTEGER DEFAULT NULL,
  p_rank_max INTEGER DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(DISTINCT up.user_id)
  INTO v_count
  FROM user_profiles up
  WHERE
    -- Stream filtering
    (p_streams IS NULL OR 'ALL' = ANY(p_streams) OR up.selected_stream = ANY(p_streams))

    -- State filtering
    AND (p_states IS NULL OR up.state = ANY(p_states))

    -- Category filtering
    AND (p_categories IS NULL OR up.category = ANY(p_categories))

    -- Rank filtering
    AND (p_rank_min IS NULL OR up.neet_rank >= p_rank_min)
    AND (p_rank_max IS NULL OR up.neet_rank <= p_rank_max)

    -- Segment filtering
    AND (
      'all_users' = ANY(p_segments) OR
      ('new_users' = ANY(p_segments) AND up.created_at > NOW() - INTERVAL '30 days') OR
      ('active_users' = ANY(p_segments) AND up.updated_at > NOW() - INTERVAL '7 days')
    );

  RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

-- Only admins can manage admin notifications
CREATE POLICY admin_notifications_admin_all ON admin_notifications
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- Users can view their own deliveries
CREATE POLICY notification_deliveries_user_select ON notification_deliveries
  FOR SELECT
  USING (user_id = auth.uid());

-- Admins can view all deliveries
CREATE POLICY notification_deliveries_admin_all ON notification_deliveries
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- Templates accessible to admins
CREATE POLICY notification_templates_admin_all ON notification_templates
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );
