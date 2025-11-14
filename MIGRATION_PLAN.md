# Complete Migration Plan: Parquet to Supabase PostgreSQL

## Executive Summary

The application was originally designed with a **hybrid architecture** using:
- Parquet files for college/course/cutoff data (DuckDB queries)
- JSON file caching
- Supabase PostgreSQL for user data and authentication

**Current Status:** ⚠️ **INCOMPLETE MIGRATION**
- User-facing features use Supabase ✅
- Data services still use Parquet files ⚠️
- Admin notification system lacks database integration ❌
- Hardcoded security credentials present ❌

**Goal:** Complete migration to 100% Supabase PostgreSQL API-based architecture

---

## Part 1: Critical Security Fixes (IMMEDIATE)

### 1.1 Hardcoded Admin Password

**Location:** `/src/components/AdminMasterData.tsx:19`

```typescript
const ADMIN_PASSWORD = 'neetlogiq_master_2024'; // EXPOSED IN CLIENT CODE!
```

**Issue:** Password visible in browser source code, completely insecure

**Solution:**
- Move to backend API route with proper authentication
- Use existing admin auth middleware (`checkAdminAccess`)
- Remove client-side password check entirely

**Files to Modify:**
- Delete `/src/components/AdminMasterData.tsx` OR
- Convert to use Supabase admin auth instead of password

---

### 1.2 Hardcoded Admin Emails

**Location:** `/src/config/admin.ts`

```typescript
const ADMIN_EMAILS = [
  'kashyap0071232000@gmail.com',
  'neetlogiq@gmail.com',
  'kashyap2k007@gmail.com'
];
```

**Issue:** Admin emails exposed in source code

**Solution:**
- These are now redundant (admin roles stored in `user_profiles.role`)
- Keep file for permission definitions only
- Remove email array or move to environment variables

---

## Part 2: Admin Notifications Database Schema (HIGH PRIORITY)

### 2.1 Current State

**Existing Table:** `notifications` - User notifications only
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  type TEXT,
  title TEXT,
  message TEXT,
  read BOOLEAN DEFAULT false,
  ...
);
```

**Missing Tables:**
1. `admin_notifications` - Admin-created notification templates
2. `notification_deliveries` - Track delivery to each user
3. `notification_templates` - Reusable templates
4. `notification_analytics` - Aggregate analytics

---

### 2.2 Required Database Schema

Create new migration: `supabase/migrations/003_admin_notifications.sql`

```sql
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
-- NOTIFICATION TEMPLATES (OPTIONAL - Future Enhancement)
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

    -- Segment filtering (simplified - can be enhanced)
    AND (
      'all_users' = ANY(p_segments) OR
      ('new_users' = ANY(p_segments) AND up.created_at > NOW() - INTERVAL '30 days') OR
      ('active_users' = ANY(p_segments) AND up.updated_at > NOW() - INTERVAL '7 days')
    );

  RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to create user notification from admin notification
CREATE OR REPLACE FUNCTION create_user_notification_from_admin(
  p_admin_notification_id UUID,
  p_user_id UUID
) RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
  v_admin_notif admin_notifications%ROWTYPE;
BEGIN
  -- Get admin notification details
  SELECT * INTO v_admin_notif
  FROM admin_notifications
  WHERE id = p_admin_notification_id;

  -- Create user notification
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    link,
    priority,
    created_at
  ) VALUES (
    p_user_id,
    CASE
      WHEN v_admin_notif.type IN ('cutoff_update', 'college_update') THEN v_admin_notif.type
      WHEN v_admin_notif.type = 'deadline' THEN 'deadline'
      ELSE 'system'
    END,
    v_admin_notif.title,
    v_admin_notif.message,
    v_admin_notif.primary_action_url,
    CASE v_admin_notif.priority
      WHEN 'critical' THEN 'high'
      WHEN 'high' THEN 'high'
      WHEN 'medium' THEN 'medium'
      ELSE 'low'
    END,
    NOW()
  ) RETURNING id INTO v_notification_id;

  -- Track delivery
  INSERT INTO notification_deliveries (
    admin_notification_id,
    user_id,
    delivered_in_app,
    delivered_at
  ) VALUES (
    p_admin_notification_id,
    p_user_id,
    v_admin_notif.show_in_app,
    NOW()
  );

  RETURN v_notification_id;
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
```

---

### 2.3 API Route Updates Required

#### Files with TODO comments to fix:

1. **`/src/app/api/admin/notifications/route.ts`**
   - Line 38: Query notifications from database
   - Line 105: Save notification to database
   - Line 120: Update notification status after sending
   - Line 129: Update scheduled notification

2. **`/src/app/api/admin/notifications/[id]/route.ts`**
   - Line 36: Query single notification
   - Line 99: Get existing notification before update
   - Line 129: Update notification in database
   - Line 182: Delete notification from database

3. **`/src/app/api/admin/notifications/[id]/send/route.ts`**
   - Line 34: Get notification from database
   - Line 93: Update notification status after sending

**Implementation Example:**

```typescript
// GET all notifications
const { data: notifications, error } = await supabaseAdmin
  .from('admin_notifications')
  .select('*')
  .order('created_at', { ascending: false })
  .range(offset, offset + limit);

// CREATE notification
const { data: notification, error } = await supabaseAdmin
  .from('admin_notifications')
  .insert({
    title,
    message,
    type,
    target_streams: target.streams,
    target_segments: target.userSegments,
    delivery_type: schedule.deliveryType,
    priority: display.priority,
    created_by: authCheck.userId,
    status: 'draft'
  })
  .select()
  .single();

// SEND notification (bulk create user notifications)
const targetedUsers = await estimateAndGetUsers(notification.target);
const deliveries = targetedUsers.map(userId => ({
  admin_notification_id: notification.id,
  user_id: userId,
  delivered_in_app: true
}));

await supabaseAdmin.from('notification_deliveries').insert(deliveries);
await supabaseAdmin
  .from('admin_notifications')
  .update({
    status: 'sent',
    sent_at: new Date(),
    actual_delivered: deliveries.length
  })
  .eq('id', notification.id);
```

---

## Part 3: Parquet to Supabase Migration

### 3.1 Files Using Parquet Architecture

**Total:** 64 parquet-related files found

**Critical Services:**
1. `/src/services/id-based-data-service.ts` - DuckDB + Parquet for counselling data
2. `/src/services/master-data-service.ts` - DuckDB + Parquet for master data
3. `/src/services/IdBasedDataService.ts`
4. `/src/services/VectorSearchService.ts`
5. `/src/services/dataManagement.ts`
6. `/src/services/database.ts`

**Data Files:**
- `./data/compressed/cutoffs/*.parquet.gz` (7 files)
- `./autorag_data/parquet_chunks/*.parquet` (6 files)
- `./output/*.parquet` (mentioned in code)

---

### 3.2 Current Database Tables (Already in Supabase)

✅ **Already Migrated:**
- `colleges` - College master data
- `courses` - Course information
- `cutoffs` - Historical cutoff data
- `user_profiles` - User data
- `subscriptions` - Payment/subscription data
- `favorites`, `watchlist`, `college_notes` - User interactions

---

### 3.3 Migration Strategy

#### Phase 1: Data Import (One-time)

**Goal:** Import parquet data into Supabase tables

**Approach:**
1. Write Node.js migration scripts using `duckdb` package
2. Read parquet files
3. Transform to match Supabase schema
4. Bulk insert using Supabase Admin API

**Script Location:** `scripts/migrate-parquet-to-supabase.ts`

```typescript
import duckdb from 'duckdb';
import { supabaseAdmin } from '@/lib/supabase';

// Example: Migrate colleges
async function migrateColleges() {
  const db = new duckdb.Database(':memory:');
  const conn = db.connect();

  // Read parquet
  conn.all(`
    SELECT * FROM read_parquet('output/master_colleges.parquet')
  `, async (err, data) => {
    // Transform and insert to Supabase
    const colleges = data.map(row => ({
      id: row.id,
      name: row.name,
      city: row.city,
      state: row.state,
      // ... map all fields
    }));

    // Bulk insert (in batches of 1000)
    for (let i = 0; i < colleges.length; i += 1000) {
      const batch = colleges.slice(i, i + 1000);
      await supabaseAdmin.from('colleges').upsert(batch);
    }
  });
}
```

---

#### Phase 2: Service Layer Refactoring

**Goal:** Replace DuckDB/Parquet queries with Supabase queries

**Example Conversion:**

**BEFORE (Parquet):**
```typescript
// id-based-data-service.ts
conn.all(`
  SELECT * FROM read_parquet('output/counselling_data.parquet')
  WHERE college_id = '${collegeId}'
`, (err, data) => {
  // Process results
});
```

**AFTER (Supabase):**
```typescript
// supabase-data-service.ts
const { data, error } = await supabase
  .from('cutoffs')
  .select('*')
  .eq('college_id', collegeId);
```

---

#### Phase 3: Remove Legacy Code

**Files to Delete:**
1. `/src/services/id-based-data-service.ts`
2. `/src/services/master-data-service.ts`
3. `/src/services/database.ts` (if using DuckDB)
4. All parquet files in `/data/` and `/output/`
5. Scripts: `create-parquet-files.js`, `generate-optimized-parquet.js`

**Files to Keep:**
- `/src/services/supabase-data-service.ts` - Enhanced version
- Cloudflare workers (if migrated to use Supabase)

---

### 3.4 Service Replacement Plan

| Old Service | New Service | Status |
|------------|-------------|--------|
| `id-based-data-service.ts` | Create `supabase-cutoff-service.ts` | ❌ Not started |
| `master-data-service.ts` | Use Supabase tables directly | ❌ Not started |
| `VectorSearchService.ts` | Migrate to pgvector extension | ⚠️ Partial |
| `dataManagement.ts` | Admin API routes (already exist) | ✅ Done |

---

### 3.5 Performance Considerations

**Parquet Advantages (Being Lost):**
- Fast columnar queries
- Compressed storage
- Good for analytics

**Supabase Mitigation:**
- Use PostgreSQL indexes properly
- Implement materialized views for common queries
- Use PostgREST caching headers
- Consider read replicas for heavy queries

**Recommended Indexes:**
```sql
-- Critical indexes for performance
CREATE INDEX idx_cutoffs_college_year ON cutoffs(college_id, year);
CREATE INDEX idx_cutoffs_category_quota ON cutoffs(category, quota);
CREATE INDEX idx_colleges_state_type ON colleges(state, management_type);
CREATE INDEX idx_courses_stream ON courses(stream);
```

---

## Part 4: Implementation Checklist

### 4.1 Immediate Actions (This Week)

- [ ] **Fix hardcoded admin password** (AdminMasterData.tsx)
- [ ] **Fix hardcoded admin emails** (config/admin.ts)
- [ ] **Create admin notifications migration** (003_admin_notifications.sql)
- [ ] **Run migration on Supabase**
- [ ] **Implement notification CRUD in API routes**
- [ ] **Test notification creation/sending flow**

---

### 4.2 Short-term (Next 2 Weeks)

- [ ] **Write parquet migration scripts**
- [ ] **Import all parquet data to Supabase**
- [ ] **Verify data integrity** (row counts, sample checks)
- [ ] **Create replacement Supabase services**
- [ ] **Update API routes to use new services**
- [ ] **Test all features end-to-end**

---

### 4.3 Medium-term (Next Month)

- [ ] **Remove all parquet dependencies**
- [ ] **Delete legacy service files**
- [ ] **Remove parquet data files**
- [ ] **Update deployment scripts**
- [ ] **Performance testing and optimization**
- [ ] **Add monitoring/logging**
- [ ] **Update documentation**

---

## Part 5: Risk Assessment

### High Risk
- **Data loss during migration** - Mitigation: Backup parquet files, test on staging
- **Performance degradation** - Mitigation: Proper indexing, caching, monitoring
- **Breaking existing features** - Mitigation: Feature flags, gradual rollout

### Medium Risk
- **Complex query conversion** - Some DuckDB queries may not translate 1:1
- **Storage costs** - Supabase storage may cost more than parquet files
- **API rate limits** - Need to implement proper caching

### Low Risk
- **Schema changes** - Well-defined migration path
- **Authentication** - Already using Supabase auth

---

## Part 6: Current Architecture vs Target Architecture

### CURRENT (Hybrid - Problematic)
```
Frontend (Next.js)
    ├── User Features → Supabase PostgreSQL ✅
    ├── Data Queries → Parquet Files (DuckDB) ⚠️
    ├── Admin Notifications → No Database (TODO) ❌
    └── Auth → Supabase Auth ✅
```

### TARGET (Full Supabase)
```
Frontend (Next.js)
    ├── User Features → Supabase PostgreSQL ✅
    ├── Data Queries → Supabase PostgreSQL ✅
    ├── Admin Notifications → Supabase PostgreSQL ✅
    └── Auth → Supabase Auth ✅
```

---

## Part 7: Estimated Effort

| Task | Complexity | Effort | Dependencies |
|------|-----------|--------|--------------|
| Fix hardcoded credentials | Low | 2 hours | None |
| Admin notification schema | Medium | 4 hours | None |
| Notification API implementation | Medium | 8 hours | Schema |
| Parquet data migration scripts | High | 16 hours | None |
| Service layer refactoring | High | 24 hours | Data migration |
| Testing & validation | Medium | 16 hours | All above |
| Cleanup & documentation | Low | 4 hours | All above |
| **TOTAL** | | **74 hours** (~2 weeks) | |

---

## Part 8: Next Steps

### Step 1: Run This Command
```bash
# Create the admin notifications migration
cat > supabase/migrations/003_admin_notifications.sql << 'EOF'
[Paste the SQL schema from Part 2.2]
EOF

# Apply migration
supabase db push
```

### Step 2: Update API Routes
Fix all TODO comments in:
- `/src/app/api/admin/notifications/route.ts`
- `/src/app/api/admin/notifications/[id]/route.ts`
- `/src/app/api/admin/notifications/[id]/send/route.ts`

### Step 3: Remove Security Vulnerabilities
- Delete or secure `AdminMasterData.tsx`
- Remove or move admin emails from source

### Step 4: Plan Parquet Migration
- Inventory all parquet files
- Write migration scripts
- Schedule migration window

---

## Conclusion

The application is in a **transitional state** with critical gaps:

1. ✅ **Good:** User management, auth, subscriptions all use Supabase
2. ⚠️ **Partial:** Some data queries still use parquet files
3. ❌ **Missing:** Admin notification database integration
4. ❌ **Critical:** Security vulnerabilities with hardcoded credentials

**Recommended Priority:**
1. Fix security issues (IMMEDIATE)
2. Implement admin notifications database (HIGH)
3. Migrate remaining parquet services (MEDIUM)
4. Performance optimization (ONGOING)

**Timeline:** ~2 weeks for complete migration with proper testing
