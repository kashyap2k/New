# Search Page & Architecture Analysis

**Date**: November 14, 2025
**Status**: Critical Issues Found
**Priority**: HIGH

---

## Executive Summary

The search page `/search` is **BROKEN** because it calls API endpoints that **DO NOT EXIST**. Additionally, the codebase has **architectural inconsistencies** from an incomplete migration from edge-native+parquet architecture to Supabase PostgreSQL.

### Critical Issues

1. ❌ **Missing API Endpoint**: `/api/search` (called by search page but doesn't exist)
2. ❌ **Missing API Endpoint**: `/api/courses` (called by search page but doesn't exist)
3. ⚠️ **Simulated AI**: AutoRAG service returns mock data, not real AI
4. ⚠️ **Duplicate Codebase**: `edge-native-app/` folder (141MB) contains old architecture
5. ⚠️ **Parquet Files**: 100+ parquet-related files still in codebase

---

## Detailed Analysis

### 1. Search Page Issues

**File**: `/src/app/search/page.tsx`

#### What the Search Page Does:
```typescript
// Line 99: Regular search
response = await apiService.unifiedSearch({
  query,
  filters
});
```

This calls: **`GET /api/search`** ❌ **DOES NOT EXIST**

```typescript
// Line 91-95: AI search
const { autoRAGService } = await import('@/services/autorag');
const result = await autoRAGService.search({
  query,
  filters
});
```

This uses: **Mock data simulation, not real AI**

#### Why It's Broken:

1. **`apiService.unifiedSearch()`** calls `/api/search` (line 151 in `src/services/api.ts`)
2. **`/src/app/api/search/route.ts`** DOES NOT EXIST
3. Search returns **empty results or errors**

#### What Exists Instead:

- ✅ `/api/colleges` - Works (uses Supabase)
- ✅ `/api/colleges/search` - Works (uses Supabase)
- ✅ `/api/cutoffs` - Works (probably uses Supabase)
- ❌ `/api/courses` - **MISSING**
- ❌ `/api/search` - **MISSING**

---

### 2. AutoRAG Service Analysis

**File**: `/src/services/autorag.ts`

#### Current Implementation:

```typescript
async search(params: SearchParams): Promise<SearchResult> {
  // Try real AutoRAG first, fallback to simulation
  try {
    const result = await this.performRealAutoRAGSearch(query, filters);
    if (result && result.total_results > 0) {
      return result;
    }
  } catch (error) {
    console.warn('Real AutoRAG failed, falling back to simulation:', error);
  }

  // Fallback to enhanced simulation
  const result = await this.simulateAutoRAGSearch(query, filters);
  return result;
}
```

#### Reality:

- **Real AutoRAG**: Requires Cloudflare API key + Vectorize database
  - Checks `NEXT_PUBLIC_AUTORAG_API_KEY` (likely not set)
  - Falls back to simulation **immediately**

- **Simulated AutoRAG**: Returns hardcoded mock data
  ```typescript
  colleges: [
    {
      id: '1',
      name: 'All India Institute of Medical Sciences, New Delhi',
      city: 'New Delhi',
      state: 'Delhi',
      // ... hardcoded
    }
  ]
  ```

#### Conclusion:

**AI search is 100% simulated** - no real AI/ML is running.

---

### 3. Architecture Confusion

#### Current State:

```
/home/user/New/
├── src/                          # Main application (Next.js)
│   ├── app/api/                  # 47 API routes
│   ├── services/
│   │   ├── api.ts                # Calls non-existent endpoints
│   │   ├── autorag.ts            # Simulated AI
│   │   └── supabase-data-service.ts  # Real Supabase integration
│   └── ...
├── edge-native-app/              # 141MB duplicate old architecture
│   ├── src/app/search/page.tsx   # Duplicate search page
│   ├── src/services/             # Duplicate services
│   └── ...                       # Full duplicate codebase
├── scripts/                      # 100+ files
│   ├── *-parquet*.ts             # Parquet conversion scripts
│   ├── *-duckdb*.ts              # DuckDB scripts
│   └── ...
└── data/
    └── *.parquet                 # 64 parquet files (from MIGRATION_PLAN.md)
```

#### Issues:

1. **Duplicate Codebase**: `edge-native-app/` is old architecture, should be removed
2. **Parquet Files**: Still referenced in 100+ scripts and some services
3. **Incomplete Migration**: Some APIs use Supabase, some expect parquet/DuckDB
4. **Mixed Patterns**: Different API routes use different data sources

---

### 4. What's Actually Using Supabase

✅ **Migrated to Supabase:**
- Colleges (`/api/colleges`, `/api/colleges/search`)
- Cutoffs (`/api/cutoffs`)
- Admin Notifications (`/api/admin/notifications`)
- User Profiles (`user_profiles` table)
- Subscriptions (`subscriptions` table)
- Admin Authentication (`lib/admin-auth.ts`)

❓ **Unknown Status:**
- Courses (service exists but no API route)
- Analytics data
- Counselling data
- Trends data

❌ **Still Referencing Parquet:**
- 100+ scripts in `scripts/` folder
- `src/lib/data/duckdb-query-manager.ts`
- `src/lib/data/data-pipeline.ts`
- `src/hooks/useStreamBasedCutoffs.ts`
- `src/hooks/useEnhancedExcelTable.ts`

---

## Root Cause Analysis

### Why Search Page is Broken:

1. **Development History**:
   - Originally: Edge-native architecture with AI + DuckDB + Parquet files
   - Migration started: Move to Supabase PostgreSQL
   - **Migration incomplete**: API endpoints not created for new architecture

2. **Missing Implementation**:
   ```typescript
   // search page expects:
   GET /api/search?query=...&filters=...

   // should return:
   {
     colleges: [...],
     courses: [...],
     cutoffs: [...],
     total_results: N,
     search_time: T,
     suggestions: [...]
   }

   // but endpoint doesn't exist!
   ```

3. **Service Layer Ready, API Layer Missing**:
   - `SupabaseDataService` has `searchColleges()` ✅
   - `SupabaseDataService` has `searchCutoffs()` ✅
   - But `/api/search` route not created ❌
   - And `/api/courses` route not created ❌

---

## Impact Assessment

### User-Facing Issues:

1. **Search page returns no results** or errors
2. **AI search returns only hardcoded mock data** (2 colleges, 2 courses, 1 cutoff)
3. **Course search doesn't work** at all
4. **Users cannot search across colleges + courses + cutoffs** simultaneously

### Developer Issues:

1. **Confusion about which architecture to use** (parquet vs Supabase)
2. **Duplicate code maintenance** (edge-native-app folder)
3. **Deployment issues** with parquet files
4. **Wasted resources** storing 141MB duplicate code

---

## Action Plan

### Phase 1: Fix Search Page (URGENT)

**Priority**: Critical
**Estimated Time**: 2-3 hours

#### Step 1: Create Missing API Endpoints

1. **Create `/src/app/api/search/route.ts`**
   - Combine results from colleges, courses, cutoffs
   - Use `SupabaseDataService` methods
   - Return unified `SearchResult` format

2. **Create `/src/app/api/courses/route.ts`**
   - Query `courses` table from Supabase
   - Support filtering and pagination
   - Follow same pattern as `/api/colleges`

#### Step 2: Verify Search Page Works

1. Test with various queries
2. Verify filters work
3. Check pagination
4. Ensure error handling works

---

### Phase 2: Clean Up Architecture (HIGH)

**Priority**: High
**Estimated Time**: 4-6 hours

#### Step 1: Remove Duplicate Code

1. **Delete `edge-native-app/` folder** (141MB)
   ```bash
   rm -rf /home/user/New/edge-native-app
   ```

2. **Verify no imports reference it**
   ```bash
   grep -r "edge-native-app" src/
   ```

#### Step 2: Audit Parquet Dependencies

1. **Find active parquet usage**:
   ```bash
   grep -r "\.parquet" src/ --exclude-dir=node_modules
   grep -r "duckdb" src/ --exclude-dir=node_modules
   ```

2. **Create migration plan for each**:
   - If data exists in Supabase → Update code to use Supabase
   - If data doesn't exist → Migrate parquet → Supabase
   - If not needed → Remove

3. **Move scripts to archive**:
   ```bash
   mkdir -p legacy/scripts
   mv scripts/*parquet* legacy/scripts/
   mv scripts/*duckdb* legacy/scripts/
   ```

#### Step 3: Document Migration Status

Create `SUPABASE_MIGRATION_STATUS.md` with:
- ✅ What's migrated
- 🔄 What's in progress
- ❌ What's not started
- 📝 What's deprecated

---

### Phase 3: Improve AI Search (MEDIUM)

**Priority**: Medium
**Estimated Time**: 8-12 hours

#### Option A: Real Cloudflare AI (Recommended)

1. **Set up Cloudflare Vectorize**:
   - Create vector database
   - Generate embeddings for colleges/courses/cutoffs
   - Update `autoRAGService` to use real API

2. **Environment variables needed**:
   ```env
   NEXT_PUBLIC_CLOUDFLARE_ACCOUNT_ID=...
   NEXT_PUBLIC_AUTORAG_API_KEY=...
   NEXT_PUBLIC_AUTORAG_INDEX=neetlogiq-vectors
   ```

#### Option B: Remove AI Search (Simpler)

1. **Remove AI search button** from search page
2. **Keep only regular search** (works with Supabase)
3. **Document as future enhancement**

---

### Phase 4: Complete Data Migration (MEDIUM)

**Priority**: Medium
**Estimated Time**: 12-16 hours

#### Remaining Migrations:

1. **Courses** (if not fully migrated)
   - Check if `courses` table complete
   - Import missing course data
   - Create indexes for performance

2. **Analytics Data**
   - Migrate from parquet to Supabase
   - Create `analytics_events` table
   - Update analytics components

3. **Counselling Data**
   - Verify `counselling_rounds` table
   - Migrate missing data
   - Update counselling pages

4. **Trends Data**
   - Migrate historical trends
   - Create `cutoff_trends` table
   - Update trends visualization

---

## Verification Checklist

### Search Page Fixed:
- [ ] `/api/search` endpoint created
- [ ] `/api/courses` endpoint created
- [ ] Search page returns results for colleges
- [ ] Search page returns results for courses
- [ ] Search page returns results for cutoffs
- [ ] Filters work correctly
- [ ] Pagination works
- [ ] No console errors

### Architecture Cleaned:
- [ ] `edge-native-app/` folder deleted
- [ ] No imports reference deleted folder
- [ ] Parquet scripts moved to `legacy/`
- [ ] Active parquet usage audited
- [ ] Migration status documented

### Supabase Migration Complete:
- [ ] All colleges in database
- [ ] All courses in database
- [ ] All cutoffs in database
- [ ] All API routes use Supabase
- [ ] No parquet files in production
- [ ] Performance benchmarks met

---

## Risk Assessment

### High Risk:
1. **Data Loss**: Deleting parquet files before verifying data in Supabase
   - **Mitigation**: Audit + backup before deletion

2. **Breaking Changes**: Removing edge-native-app breaks active imports
   - **Mitigation**: Search codebase first

### Medium Risk:
1. **Performance**: Supabase queries slower than parquet
   - **Mitigation**: Add indexes, optimize queries

2. **Migration Errors**: Missing data during migration
   - **Mitigation**: Row count verification, test queries

### Low Risk:
1. **User Confusion**: Search page changes
   - **Mitigation**: Gradual rollout, user testing

---

## Immediate Next Steps (Recommended)

### Today (2-3 hours):

1. ✅ **Create `/src/app/api/search/route.ts`**
   - Implement unified search
   - Test with sample queries

2. ✅ **Create `/src/app/api/courses/route.ts`**
   - Query courses from Supabase
   - Support filters

3. ✅ **Test search page**
   - Verify results appear
   - Check all 3 tabs (colleges, courses, cutoffs)

4. ✅ **Commit and push**
   - Clear commit message
   - Document what was fixed

### This Week (4-6 hours):

1. 📦 **Archive old architecture**
   - Move `edge-native-app/` to backup
   - Move parquet scripts to `legacy/`

2. 📝 **Document migration status**
   - Create `SUPABASE_MIGRATION_STATUS.md`
   - Update `MIGRATION_PLAN.md`

3. 🧪 **Test all major pages**
   - Colleges page
   - Courses page
   - Cutoffs page
   - Search page
   - Analytics page

### Next Week (8-12 hours):

1. 🤖 **Decide on AI search**
   - Either: Implement real Cloudflare AI
   - Or: Remove AI search feature

2. 📊 **Complete data migration**
   - Analytics
   - Counselling
   - Trends

3. 🚀 **Deploy to production**
   - Run migrations
   - Test thoroughly
   - Monitor for errors

---

## Conclusion

The search page is broken because the architecture migration from **edge-native+parquet** to **Supabase PostgreSQL** was **incomplete**. The search page code expects API endpoints that were never created for the new architecture.

**Quick fix**: Create 2 missing API endpoints (2-3 hours)
**Proper fix**: Complete architecture migration (20-30 hours)
**Recommended**: Do quick fix now, schedule proper fix this month

---

## Questions to Resolve

1. **Should we keep AI search feature?**
   - If yes → Need to set up Cloudflare Vectorize (8-12 hours)
   - If no → Remove AI search button (30 minutes)

2. **Is all critical data in Supabase?**
   - Need to verify: colleges ✅, courses ?, cutoffs ✅, analytics ?, counselling ?

3. **Can we delete parquet files safely?**
   - After verifying all data migrated
   - After backing up to external storage
   - Recommend: Archive first, delete after 1 month

4. **What about edge-native-app folder?**
   - **Recommend**: Delete immediately (no active imports found)
   - **Safe approach**: Rename to `_DEPRECATED_edge-native-app` for 1 week first

---

## Related Documentation

- [MIGRATION_PLAN.md](./MIGRATION_PLAN.md) - Original migration strategy (created Nov 14)
- [VERCEL_DEPLOYMENT_TROUBLESHOOTING.md](./VERCEL_DEPLOYMENT_TROUBLESHOOTING.md) - Deployment issues
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Original edge-native architecture (outdated)

---

**Created**: November 14, 2025
**Author**: Claude
**Status**: Analysis Complete, Awaiting Implementation
