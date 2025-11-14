# Vercel Deployment Troubleshooting Guide

## Common Issues & Solutions

### Issue #1: Build Fails - Missing AdminMasterData

**Error:**
```
Module not found: Can't resolve '../components/AdminMasterData'
```

**Root Cause:**
- `AdminMasterData.tsx` was deleted due to security vulnerability (hardcoded password)
- Example file `src/examples/complete-integration-demo.ts` was importing it

**Solution:**
✅ **FIXED** - Deleted `src/examples/complete-integration-demo.ts` (not used in production)

---

### Issue #2: TypeScript Errors in Production Build

**Potential Error:**
```
Type 'any' is not assignable to type...
```

**Location:** `/src/app/api/admin/notifications/route.ts`
- Function `dbToAdminNotification(dbRecord: any)` uses `any` type

**Solution:**
Create proper type for database records:

```typescript
// Add to notification route file
interface AdminNotificationDbRecord {
  id: string;
  title: string;
  message: string;
  type: string;
  target_streams: string[];
  target_segments: string[];
  // ... all other fields
}

// Update function signature
function dbToAdminNotification(dbRecord: AdminNotificationDbRecord): AdminNotification {
  // ... existing code
}
```

**Quick Fix (if needed urgently):**
Add to `tsconfig.json`:
```json
{
  "compilerOptions": {
    "noImplicitAny": false  // Allows 'any' type
  }
}
```

---

### Issue #3: Missing Environment Variables

**Error:**
```
Error: Missing environment variables
```

**Required Environment Variables in Vercel:**

Go to: `Vercel Dashboard > Your Project > Settings > Environment Variables`

#### Critical (Required for Build):
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456:web:abc123
```

#### Payment (Required for subscriptions):
```env
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_xxxxx
RAZORPAY_KEY_SECRET=your_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
```

#### Cron Jobs (Required for scheduled tasks):
```env
CRON_SECRET=generate_with_openssl_rand_base64_32
```

#### Application:
```env
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
NODE_ENV=production
```

**How to Set:**
1. Copy from `.env.local` (local development)
2. Update production values (especially Razorpay keys)
3. Add each variable in Vercel dashboard
4. Redeploy after adding variables

---

### Issue #4: Database Migration Not Applied

**Error:**
```
relation "admin_notifications" does not exist
```

**Root Cause:**
- New migration `003_admin_notifications.sql` created locally
- Not yet applied to production Supabase database

**Solution:**

#### Option A: Apply via Supabase Dashboard
1. Go to Supabase Dashboard > SQL Editor
2. Copy contents of `supabase/migrations/003_admin_notifications.sql`
3. Paste and run in SQL Editor
4. Verify tables created: `admin_notifications`, `notification_deliveries`, `notification_templates`

#### Option B: Apply via Supabase CLI
```bash
# Link to production project
supabase link --project-ref your-project-ref

# Push migrations
supabase db push

# Or apply specific migration
supabase migration up --db-url "your-production-database-url"
```

---

### Issue #5: Import Path Errors (Case Sensitivity)

**Error:**
```
Module not found: Can't resolve '@/Components/...'
```

**Root Cause:**
- Local dev (macOS/Windows) is case-insensitive
- Vercel (Linux) is case-sensitive

**Solution:**
Check all imports are exact case:
```typescript
// ✅ Correct
import { supabase } from '@/lib/supabase';
import AdminDashboard from '@/components/admin/AdminDashboard';

// ❌ Wrong (case mismatch)
import { supabase } from '@/Lib/supabase';
import AdminDashboard from '@/Components/Admin/AdminDashboard';
```

**Find case issues:**
```bash
# Search for potential issues
grep -r "from '@/Components" src/
grep -r "from '@/Lib" src/
grep -r "from '@/Services" src/
```

---

### Issue #6: Node.js Version Mismatch

**Error:**
```
Error: The engine "node" is incompatible with this module
```

**Solution:**

Add to `package.json`:
```json
{
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  }
}
```

Or in Vercel Dashboard:
- Settings > General > Node.js Version
- Select: `18.x` or `20.x`

---

### Issue #7: Build Timeout

**Error:**
```
Error: Command "npm run build" timed out after 300000ms
```

**Causes:**
- Large dependencies (DuckDB, Parquet files)
- Complex TypeScript compilation

**Solutions:**

1. **Increase timeout in Vercel:**
   - Pro plan: Up to 45 minutes
   - Free plan: Limited to 5 minutes

2. **Optimize build:**
   ```json
   // next.config.mjs
   export default {
     experimental: {
       optimizeCss: true,
       turbotrace: {
         contextDirectory: '../../',
         maxFiles: 200
       }
     }
   }
   ```

3. **Exclude unnecessary files:**
   Create `.vercelignore`:
   ```
   data/
   output/
   *.parquet
   *.csv
   autorag_data/
   scripts/
   .git/
   ```

---

### Issue #8: Memory Limit Exceeded

**Error:**
```
Error: JavaScript heap out of memory
```

**Solution:**

Update `package.json` build script:
```json
{
  "scripts": {
    "build": "NODE_OPTIONS='--max-old-space-size=4096' next build"
  }
}
```

---

### Issue #9: Middleware/Edge Runtime Issues

**Error:**
```
Error: Cannot use Node.js runtime in Edge function
```

**Root Cause:**
- Using Node-only modules (fs, path, DuckDB) in Edge runtime

**Solution:**

Check `src/middleware.ts` and API routes:
```typescript
// ✅ For Edge runtime
export const runtime = 'edge';

// ✅ For Node runtime
export const runtime = 'nodejs';
```

Avoid in Edge runtime:
- `fs`, `path`, `crypto` (Node APIs)
- `duckdb`, `better-sqlite3`
- File system operations

---

### Issue #10: PostCSS/Tailwind Errors

**Error:**
```
Error: Cannot find module 'tailwindcss'
```

**Solution:**

Ensure all PostCSS deps are in dependencies (not devDependencies):
```json
{
  "dependencies": {
    "autoprefixer": "^10.4.21",
    "postcss": "^8.5.6",
    "tailwindcss": "^3.4.0"
  }
}
```

---

## Debugging Checklist

### Pre-Deployment
- [ ] `npm run build` succeeds locally
- [ ] All environment variables documented
- [ ] No hardcoded secrets in code
- [ ] Database migrations applied to production
- [ ] No `console.log()` with sensitive data

### During Deployment
- [ ] Check Vercel build logs for specific error
- [ ] Verify all environment variables set
- [ ] Check Node.js version matches
- [ ] Verify database connection works

### Post-Deployment
- [ ] Test critical user flows
- [ ] Check admin panel works
- [ ] Test notification creation
- [ ] Verify cron jobs scheduled
- [ ] Monitor error logs (Vercel > Logs)

---

## Quick Fixes

### 1. Clear Build Cache
```bash
# In Vercel Dashboard
Settings > General > Clear Cache and Redeploy
```

### 2. Force Reinstall Dependencies
```bash
# Delete and redeploy
rm -rf node_modules .next
npm install
npm run build
```

### 3. Enable Verbose Logging
```bash
# In package.json
"build": "next build --debug"
```

### 4. Test Production Build Locally
```bash
npm run build
npm run start
# Test on http://localhost:3000
```

---

## Common Error Messages Decoded

| Error | Meaning | Fix |
|-------|---------|-----|
| `Module not found` | Import path wrong or file missing | Check import paths, case sensitivity |
| `Type error` | TypeScript compilation failed | Fix type errors or adjust tsconfig |
| `relation does not exist` | Database table missing | Apply migrations |
| `Missing env variable` | Environment variable not set | Add in Vercel dashboard |
| `Command timeout` | Build took too long | Optimize build or upgrade plan |
| `Heap out of memory` | Build needs more RAM | Increase Node memory limit |

---

## Vercel-Specific Optimizations

### 1. Function Size Limits

**Error:**
```
Function size limit exceeded: 50MB
```

**Solution:**
- Move large dependencies to server components
- Use dynamic imports: `const module = await import('...')`
- Exclude unused code

### 2. Edge Network Optimization

Add edge config to frequently accessed APIs:
```typescript
// app/api/colleges/route.ts
export const runtime = 'edge';
export const preferredRegion = 'iad1'; // or your region
```

### 3. ISR (Incremental Static Regeneration)

For data-heavy pages:
```typescript
// app/colleges/page.tsx
export const revalidate = 3600; // Revalidate every hour
```

---

## Getting Help

If none of these solutions work:

1. **Check Vercel Build Logs:**
   - Vercel Dashboard > Deployments > Click failed deployment > View logs
   - Copy the FULL error message

2. **Check GitHub Issues:**
   - Search for error in Next.js issues
   - Search for error in Vercel discussions

3. **Contact Support:**
   - Vercel Support: https://vercel.com/support
   - Provide: Build logs, error message, deployment URL

---

## Current Known Issues (From Our Recent Changes)

### ✅ FIXED
- AdminMasterData import error → File deleted
- Hardcoded password vulnerability → Removed

### ⚠️ TO VERIFY
- Database migration applied to production
- Environment variables set in Vercel
- TypeScript `any` type in dbToAdminNotification

### 📝 RECOMMENDED
1. Apply `003_admin_notifications.sql` migration to production
2. Verify all environment variables in Vercel dashboard
3. Test notification creation in production after deployment
4. Monitor Vercel logs for first few deployments

---

## Pro Tips

1. **Always test build locally first:**
   ```bash
   npm run build && npm run start
   ```

2. **Use preview deployments:**
   - Every PR creates preview deployment
   - Test before merging to main

3. **Enable automatic deployments:**
   - Vercel Dashboard > Settings > Git
   - Auto-deploy on push to main

4. **Monitor performance:**
   - Vercel Analytics
   - Web Vitals
   - Error tracking

5. **Use environment-specific configs:**
   ```typescript
   const isDev = process.env.NODE_ENV === 'development';
   const isProd = process.env.NODE_ENV === 'production';
   ```

---

## Last Updated
Created: Nov 14, 2025
Based on: Next.js 16.0.0, Vercel deployment issues

## Related Documentation
- [MIGRATION_PLAN.md](./MIGRATION_PLAN.md) - Database migration strategy
- [.env.example](./.env.example) - Environment variables reference
- [package.json](./package.json) - Dependencies and scripts
