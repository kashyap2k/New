# 🤖 Cloudflare AI + Vectorize Setup Guide

**Goal**: Implement real AI-powered search using Cloudflare Workers AI and Vectorize

**Estimated Time**: 8-12 hours
**Cost**: ~$1/month (within free tier)
**Benefits**: <50ms latency, edge-native, scalable

---

## 📋 **Prerequisites**

1. Cloudflare account (free tier OK)
2. Vercel deployment (already have ✅)
3. Supabase database with colleges/courses/cutoffs (already have ✅)

---

## 🚀 **Step-by-Step Implementation**

### **Step 1: Cloudflare Setup** (15 minutes)

1. **Create Cloudflare Account** (if not already)
   - Go to https://cloudflare.com
   - Sign up for free

2. **Get API Token**:
   ```bash
   # Go to: https://dash.cloudflare.com/profile/api-tokens
   # Click "Create Token"
   # Use "Edit Cloudflare Workers" template
   # Or create custom with:
   - Account.Vectorize: Edit
   - Account.Workers AI: Edit
   ```

3. **Get Account ID**:
   ```bash
   # Dashboard → Workers & Pages → Overview
   # Right sidebar shows "Account ID"
   # Copy this value
   ```

4. **Add to Environment Variables**:
   ```env
   # .env.local
   CLOUDFLARE_ACCOUNT_ID=your_account_id_here
   CLOUDFLARE_API_TOKEN=your_api_token_here
   CLOUDFLARE_VECTORIZE_INDEX=neetlogiq-vectors
   ```

---

### **Step 2: Create Vectorize Index** (10 minutes)

```bash
# Install Wrangler CLI (Cloudflare's tool)
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Create vector index
wrangler vectorize create neetlogiq-vectors \
  --dimensions=768 \
  --metric=cosine

# Verify creation
wrangler vectorize list
```

**Expected Output**:
```
📊 Created index 'neetlogiq-vectors'
   Dimensions: 768
   Metric: cosine
   Status: ready
```

---

### **Step 3: Generate Embeddings** (2-3 hours)

Create script to generate embeddings for all data:

```typescript
// scripts/generate-embeddings.ts
import { createClient } from '@supabase/supabase-js';

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN!;
const BATCH_SIZE = 100;

// Generate embedding using Cloudflare Workers AI
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/baai/bge-large-en-v1.5`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: [text]
      })
    }
  );

  const data = await response.json();
  return data.result.data[0];
}

// Process colleges
async function processColleges() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: colleges } = await supabase
    .from('colleges')
    .select('*');

  console.log(`Processing ${colleges?.length} colleges...`);

  const vectors = [];

  for (const college of colleges || []) {
    // Create searchable text
    const text = `${college.name} ${college.city} ${college.state} ${college.stream} ${college.management_type}`;

    // Generate embedding
    const embedding = await generateEmbedding(text);

    vectors.push({
      id: college.id,
      values: embedding,
      metadata: {
        type: 'college',
        name: college.name,
        city: college.city,
        state: college.state,
        stream: college.stream,
        management_type: college.management_type,
      }
    });

    // Batch upload every 100 vectors
    if (vectors.length >= BATCH_SIZE) {
      await uploadToVectorize(vectors);
      vectors.length = 0;
    }

    // Rate limit: 100 requests/minute on free tier
    await new Promise(resolve => setTimeout(resolve, 600));
  }

  // Upload remaining vectors
  if (vectors.length > 0) {
    await uploadToVectorize(vectors);
  }
}

// Upload vectors to Vectorize
async function uploadToVectorize(vectors: any[]) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/vectorize/indexes/neetlogiq-vectors/insert`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ vectors })
    }
  );

  const result = await response.json();
  console.log(`Uploaded ${vectors.length} vectors`);
  return result;
}

// Run
processColleges().then(() => console.log('Done!'));
```

**Run the script**:
```bash
npx tsx scripts/generate-embeddings.ts
```

---

### **Step 4: Update AutoRAG Service** (3-4 hours)

Update `src/services/autorag.ts` to use real Cloudflare AI:

```typescript
// src/services/autorag.ts
import { SearchResult, SearchParams } from '@/types';

class AutoRAGService {
  private config = {
    accountId: process.env.NEXT_PUBLIC_CLOUDFLARE_ACCOUNT_ID || '',
    apiToken: process.env.CLOUDFLARE_API_TOKEN || '',
    indexName: process.env.CLOUDFLARE_VECTORIZE_INDEX || 'neetlogiq-vectors',
  };

  /**
   * Perform real AI-powered search
   */
  async search(params: SearchParams): Promise<SearchResult> {
    const { query, filters = {} } = params;

    if (!query || query.trim().length === 0) {
      return this.getEmptyResult();
    }

    try {
      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(query);

      // Search vector database
      const vectorResults = await this.searchVectorDatabase(queryEmbedding, filters);

      // Process and return results
      return this.processVectorResults(vectorResults);

    } catch (error) {
      console.error('AutoRAG search error:', error);
      // Fallback to basic search on error
      return this.fallbackSearch(query, filters);
    }
  }

  /**
   * Generate embedding using Cloudflare Workers AI
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.config.accountId}/ai/run/@cf/baai/bge-large-en-v1.5`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: [text]
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Embedding generation failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.result.data[0];
  }

  /**
   * Search Vectorize database
   */
  private async searchVectorDatabase(
    queryEmbedding: number[],
    filters: any
  ): Promise<any[]> {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.config.accountId}/vectorize/indexes/${this.config.indexName}/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vector: queryEmbedding,
          topK: 50,
          returnValues: true,
          returnMetadata: 'all',
          filter: this.buildVectorFilter(filters)
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Vector search failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.result.matches || [];
  }

  /**
   * Build filter for vector search
   */
  private buildVectorFilter(filters: any): any {
    const vectorFilter: any = {};

    if (filters.stream) {
      vectorFilter.stream = filters.stream;
    }
    if (filters.state) {
      vectorFilter.state = filters.state;
    }
    if (filters.management_type) {
      vectorFilter.management_type = filters.management_type;
    }

    return Object.keys(vectorFilter).length > 0 ? vectorFilter : undefined;
  }

  /**
   * Process vector search results
   */
  private processVectorResults(matches: any[]): SearchResult {
    const colleges: any[] = [];
    const courses: any[] = [];
    const cutoffs: any[] = [];

    for (const match of matches) {
      const metadata = match.metadata;

      if (metadata.type === 'college') {
        colleges.push({
          id: match.id,
          name: metadata.name,
          city: metadata.city,
          state: metadata.state,
          stream: metadata.stream,
          management_type: metadata.management_type,
          relevance_score: match.score,
        });
      }
      // Similar for courses and cutoffs...
    }

    return {
      colleges: colleges.slice(0, 10),
      courses: courses.slice(0, 10),
      cutoffs: cutoffs.slice(0, 10),
      total_results: colleges.length + courses.length + cutoffs.length,
      search_time: 0, // Will be calculated by API
      suggestions: this.generateSuggestions(matches),
    };
  }

  /**
   * Fallback to basic search on error
   */
  private async fallbackSearch(query: string, filters: any): Promise<SearchResult> {
    // Use regular API search as fallback
    const response = await fetch(`/api/search?query=${encodeURIComponent(query)}`);
    const data = await response.json();
    return data;
  }

  private getEmptyResult(): SearchResult {
    return {
      colleges: [],
      courses: [],
      cutoffs: [],
      total_results: 0,
      search_time: 0,
      suggestions: [],
    };
  }

  private generateSuggestions(matches: any[]): string[] {
    // Extract common terms from top matches
    const terms = new Set<string>();
    matches.slice(0, 5).forEach(match => {
      if (match.metadata.name) {
        match.metadata.name.split(' ').forEach((word: string) => {
          if (word.length > 3) terms.add(word);
        });
      }
    });
    return Array.from(terms).slice(0, 5);
  }
}

export const autoRAGService = new AutoRAGService();
export default autoRAGService;
```

---

### **Step 5: Testing** (1-2 hours)

1. **Test Embedding Generation**:
   ```bash
   # Test script
   curl -X POST \
     "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/ai/run/@cf/baai/bge-large-en-v1.5" \
     -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"text": ["AIIMS Delhi medical college"]}'
   ```

2. **Test Vector Search**:
   ```bash
   # After uploading vectors, test query
   curl -X POST \
     "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/vectorize/indexes/neetlogiq-vectors/query" \
     -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "vector": [0.1, 0.2, ...],  # Use actual embedding
       "topK": 5,
       "returnMetadata": "all"
     }'
   ```

3. **Test in Application**:
   - Go to `/search` page
   - Toggle "AI Search" mode
   - Search for "medical colleges in delhi"
   - Verify results are relevant

---

### **Step 6: Optimization** (2-3 hours)

1. **Add Caching**:
   ```typescript
   // Cache embeddings for common queries
   const embeddingCache = new Map<string, number[]>();

   async function getCachedEmbedding(text: string): Promise<number[]> {
     if (embeddingCache.has(text)) {
       return embeddingCache.get(text)!;
     }
     const embedding = await generateEmbedding(text);
     embeddingCache.set(text, embedding);
     return embedding;
   }
   ```

2. **Add Analytics**:
   ```typescript
   // Track search quality
   async function logSearchMetrics(query: string, results: any[], relevance: number) {
     await supabase.from('search_analytics').insert({
       query,
       results_count: results.length,
       relevance_score: relevance,
       timestamp: new Date().toISOString()
     });
   }
   ```

3. **Monitor Performance**:
   - Cloudflare Dashboard → Vectorize → neetlogiq-vectors
   - Check query latency (should be <50ms)
   - Check query success rate (should be >99%)

---

## 💰 **Cost Breakdown**

### Free Tier Limits:
- **Vectorize**:
  - 30M vector dimensions/month
  - 30M queries/month
  - Free for small-medium apps

- **Workers AI**:
  - 10,000 neurons/day free
  - Then $0.011 per 1,000 neurons

### Your Usage (Estimated):
- **Vectors**: 10,000 items × 768 dimensions = 7.68M dimensions (25% of free tier)
- **Queries**: ~100,000/month (0.3% of free tier)
- **Cost**: **$0/month** (well within free tier)

When you scale:
- 100,000 colleges: ~77M dimensions = **$3/month**
- 1M searches/month: **$0/month** (still free)

---

## 🎯 **Success Metrics**

After implementation, expect:
- **Search Relevance**: 85-95% (vs 60% basic search)
- **Latency**: <100ms total (50ms vector search + 50ms API overhead)
- **User Satisfaction**: Higher (semantic understanding)
- **Coverage**: Handles typos, synonyms, contextual queries

**Example Improvements**:
- Query: "top government medical colleges delhi"
  - Before: Exact word matching only
  - After: Understands "top" = high ranking, "government" = management type

- Query: "mbbs seats in mumbai"
  - Before: Separate search for each word
  - After: Semantic understanding of intent

---

## 🐛 **Troubleshooting**

### Issue: "API token invalid"
**Solution**: Regenerate token with correct permissions

### Issue: "Index not found"
**Solution**: Verify index name matches environment variable

### Issue: "Embedding generation slow"
**Solution**: Batch requests, use caching

### Issue: "No results returned"
**Solution**: Check if vectors were uploaded successfully

---

## 📚 **Resources**

- [Cloudflare Vectorize Docs](https://developers.cloudflare.com/vectorize/)
- [Workers AI Docs](https://developers.cloudflare.com/workers-ai/)
- [BGE Embeddings Model](https://huggingface.co/BAAI/bge-large-en-v1.5)

---

## ✅ **Implementation Checklist**

- [ ] Cloudflare account created
- [ ] API token generated
- [ ] Account ID obtained
- [ ] Environment variables set
- [ ] Vectorize index created
- [ ] Embedding generation script written
- [ ] All data embedded and uploaded
- [ ] AutoRAG service updated
- [ ] Testing completed
- [ ] Caching implemented
- [ ] Monitoring set up
- [ ] Documentation updated

---

**Status**: Ready to implement
**Next Step**: Create Cloudflare account and get API credentials
