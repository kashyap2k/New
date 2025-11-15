-- ID-Based Architecture Performance Indexes
-- Optimizes ID resolution, link table queries, and graph traversal
-- Created for Phase 1 of ID-based architecture improvements

-- ================================================================
-- 1. COMPOSITE KEY INDEXES (for multi-column lookups)
-- ================================================================

-- College composite key index (ID + name + state for ID resolution)
CREATE INDEX IF NOT EXISTS idx_colleges_composite_key
ON colleges(id, name, state);

-- Course composite key index (ID + college_id + name for relationship queries)
CREATE INDEX IF NOT EXISTS idx_courses_composite_key
ON courses(id, college_id, name);

-- Cutoff composite key index (ID + college_id + course_id + year for precise lookups)
CREATE INDEX IF NOT EXISTS idx_cutoffs_composite_key
ON cutoffs(id, college_id, course_id, year);

-- ================================================================
-- 2. LINK TABLE PERFORMANCE INDEXES
-- ================================================================

-- State-College link table composite index (for state-based college lookups)
CREATE INDEX IF NOT EXISTS idx_state_college_link_lookup
ON state_college_link(college_id, state_id, composite_college_key);

-- State-Course-College link table composite index (for cross-referencing)
CREATE INDEX IF NOT EXISTS idx_state_course_college_link_lookup
ON state_course_college_link(college_id, course_id, state_id);

-- Additional link table indexes for reverse lookups
CREATE INDEX IF NOT EXISTS idx_state_college_link_state_lookup
ON state_college_link(state_id, college_id);

CREATE INDEX IF NOT EXISTS idx_state_college_link_composite_key
ON state_college_link(composite_college_key);

CREATE INDEX IF NOT EXISTS idx_state_course_college_link_course_lookup
ON state_course_college_link(course_id, college_id);

CREATE INDEX IF NOT EXISTS idx_state_course_college_link_state_lookup
ON state_course_college_link(state_id, course_id);

-- ================================================================
-- 3. TRIGRAM INDEXES (for fuzzy matching - requires pg_trgm extension)
-- ================================================================

-- Enable pg_trgm extension for fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- College name trigram index (for fuzzy name matching)
CREATE INDEX IF NOT EXISTS idx_colleges_name_trgm
ON colleges USING gin(name gin_trgm_ops);

-- Course name trigram index (for fuzzy course search)
CREATE INDEX IF NOT EXISTS idx_courses_name_trgm
ON courses USING gin(name gin_trgm_ops);

-- Link table college name trigram (for fallback searches)
CREATE INDEX IF NOT EXISTS idx_state_college_link_name_trgm
ON state_college_link USING gin(college_name gin_trgm_ops);

-- ================================================================
-- 4. FOREIGN KEY OPTIMIZATION INDEXES (if not already covered)
-- ================================================================

-- Ensure foreign key columns are indexed for JOIN performance
-- (Most already exist from 004_performance_indexes.sql, these are backups)

CREATE INDEX IF NOT EXISTS idx_courses_college_id_fk
ON courses(college_id) WHERE college_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cutoffs_college_id_fk
ON cutoffs(college_id) WHERE college_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cutoffs_course_id_fk
ON cutoffs(course_id) WHERE course_id IS NOT NULL;

-- ================================================================
-- 5. PARTIAL INDEXES (for common filtered queries)
-- ================================================================

-- Active colleges only (excludes inactive colleges from searches)
CREATE INDEX IF NOT EXISTS idx_colleges_active
ON colleges(id, name, state) WHERE is_active = true;

-- Non-null college_id in courses (for ID-based queries)
CREATE INDEX IF NOT EXISTS idx_courses_with_college_id
ON courses(college_id, id) WHERE college_id IS NOT NULL;

-- Recent cutoffs (last 5 years) for faster dashboard queries
CREATE INDEX IF NOT EXISTS idx_cutoffs_recent
ON cutoffs(college_id, course_id, year)
WHERE year >= EXTRACT(YEAR FROM CURRENT_DATE) - 5;

-- ================================================================
-- 6. COVERING INDEXES (include commonly selected columns)
-- ================================================================

-- College search covering index (avoids table lookup)
CREATE INDEX IF NOT EXISTS idx_colleges_search_covering
ON colleges(state, name) INCLUDE (id, city, management_type, stream);

-- Course search covering index
CREATE INDEX IF NOT EXISTS idx_courses_search_covering
ON courses(stream, branch) INCLUDE (id, name, college_id, seats_available);

-- ================================================================
-- PERFORMANCE NOTES
-- ================================================================

-- Expected improvements:
-- 1. ID resolution: 200-500ms → 20-50ms (10x faster)
-- 2. Link table queries: 100-300ms → 10-30ms (10x faster)
-- 3. Fuzzy matching: Not supported → 100-200ms (NEW)
-- 4. Cross-referencing: Multiple queries → Single query (5x faster)
-- 5. Graph traversal: Slow → 50-100ms (optimized)

-- Monitor index usage:
-- SELECT
--   schemaname,
--   tablename,
--   indexname,
--   idx_scan as scans,
--   idx_tup_read as tuples_read,
--   idx_tup_fetch as tuples_fetched,
--   pg_size_pretty(pg_relation_size(indexrelid)) as index_size
-- FROM pg_stat_user_indexes
-- WHERE schemaname = 'public'
-- ORDER BY idx_scan DESC;

-- Check for unused indexes (consider dropping if idx_scan = 0 after a week):
-- SELECT
--   schemaname,
--   tablename,
--   indexname,
--   idx_scan,
--   pg_size_pretty(pg_relation_size(indexrelid)) as size
-- FROM pg_stat_user_indexes
-- WHERE schemaname = 'public' AND idx_scan = 0
-- ORDER BY pg_relation_size(indexrelid) DESC;
