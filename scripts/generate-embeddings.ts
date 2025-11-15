/**
 * Generate Embeddings for Cloudflare Vectorize
 *
 * This script:
 * 1. Fetches all colleges, courses, and cutoffs from Supabase
 * 2. Generates text embeddings using Cloudflare Workers AI
 * 3. Uploads vectors to Cloudflare Vectorize index
 *
 * Usage:
 *   npx tsx scripts/generate-embeddings.ts
 *
 * Requirements:
 *   - Environment variables set in .env.local
 *   - Vectorize index created (run setup-vectorize.sh first)
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Configuration
const CLOUDFLARE_ACCOUNT_ID = process.env.NEXT_PUBLIC_CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.NEXT_PUBLIC_AUTORAG_API_KEY;
const VECTORIZE_INDEX = process.env.NEXT_PUBLIC_AUTORAG_INDEX || 'neetlogiq-vectors';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const BATCH_SIZE = 10; // Process 10 items at a time
const EMBEDDING_MODEL = '@cf/baai/bge-large-en-v1.5'; // 768 dimensions

// Validate configuration
if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
  console.error('❌ Missing Cloudflare configuration!');
  console.error('Please set NEXT_PUBLIC_CLOUDFLARE_ACCOUNT_ID and NEXT_PUBLIC_AUTORAG_API_KEY in .env.local');
  process.exit(1);
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase configuration!');
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Stats tracking
const stats = {
  colleges: 0,
  courses: 0,
  cutoffs: 0,
  errors: 0,
  startTime: Date.now()
};

/**
 * Generate embedding for a text using Cloudflare Workers AI
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${EMBEDDING_MODEL}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: [text]
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Embedding generation failed: ${response.statusText} - ${error}`);
  }

  const data = await response.json();
  return data.result.data[0];
}

/**
 * Upload vectors to Vectorize index in batch
 */
async function uploadVectorsBatch(vectors: any[]): Promise<void> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/vectorize/indexes/${VECTORIZE_INDEX}/upsert`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ vectors })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Vector upload failed: ${response.statusText} - ${error}`);
  }
}

/**
 * Generate searchable text for a college
 */
function getCollegeText(college: any): string {
  return [
    college.name,
    college.city,
    college.state,
    college.stream,
    college.management_type,
    college.university_affiliation,
    `${college.niac_grade || ''} ${college.nirf_rank || ''}`,
  ].filter(Boolean).join(' ');
}

/**
 * Generate searchable text for a course
 */
function getCourseText(course: any): string {
  return [
    course.name,
    course.college_name,
    course.stream,
    course.branch,
    course.degree_type,
    course.description,
    `${course.duration || ''} years`,
    `${course.total_seats || ''} seats`,
  ].filter(Boolean).join(' ');
}

/**
 * Generate searchable text for a cutoff
 */
function getCutoffText(cutoff: any): string {
  return [
    cutoff.college_name,
    cutoff.course_name,
    `Year ${cutoff.year}`,
    cutoff.category,
    cutoff.quota,
    `Round ${cutoff.round || 1}`,
    `Opening rank: ${cutoff.opening_rank}`,
    `Closing rank: ${cutoff.closing_rank}`,
  ].filter(Boolean).join(' ');
}

/**
 * Process colleges and generate embeddings
 */
async function processColleges() {
  console.log('\n📚 Processing colleges...');

  const { data: colleges, error } = await supabase
    .from('colleges')
    .select('*')
    .limit(1000); // Process first 1000 colleges

  if (error) {
    console.error('❌ Error fetching colleges:', error);
    return;
  }

  if (!colleges || colleges.length === 0) {
    console.log('⚠️  No colleges found in database');
    return;
  }

  console.log(`Found ${colleges.length} colleges`);

  // Process in batches
  for (let i = 0; i < colleges.length; i += BATCH_SIZE) {
    const batch = colleges.slice(i, i + BATCH_SIZE);
    const vectors = [];

    for (const college of batch) {
      try {
        const text = getCollegeText(college);
        const embedding = await generateEmbedding(text);

        vectors.push({
          id: `college_${college.id}`,
          values: embedding,
          metadata: {
            type: 'college',
            id: college.id,
            name: college.name,
            city: college.city,
            state: college.state,
            stream: college.stream,
            management_type: college.management_type,
          }
        });

        stats.colleges++;

        // Rate limiting: 50ms delay between embeddings
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        console.error(`❌ Error processing college ${college.id}:`, error);
        stats.errors++;
      }
    }

    // Upload batch
    if (vectors.length > 0) {
      try {
        await uploadVectorsBatch(vectors);
        console.log(`✅ Uploaded batch ${Math.floor(i / BATCH_SIZE) + 1} (${vectors.length} colleges)`);
      } catch (error) {
        console.error(`❌ Error uploading batch:`, error);
        stats.errors++;
      }
    }

    // Progress
    console.log(`Progress: ${Math.min(i + BATCH_SIZE, colleges.length)}/${colleges.length} colleges`);
  }
}

/**
 * Process courses and generate embeddings
 */
async function processCourses() {
  console.log('\n📖 Processing courses...');

  const { data: courses, error } = await supabase
    .from('courses')
    .select('*')
    .limit(1000); // Process first 1000 courses

  if (error) {
    console.error('❌ Error fetching courses:', error);
    return;
  }

  if (!courses || courses.length === 0) {
    console.log('⚠️  No courses found in database');
    return;
  }

  console.log(`Found ${courses.length} courses`);

  // Process in batches
  for (let i = 0; i < courses.length; i += BATCH_SIZE) {
    const batch = courses.slice(i, i + BATCH_SIZE);
    const vectors = [];

    for (const course of batch) {
      try {
        const text = getCourseText(course);
        const embedding = await generateEmbedding(text);

        vectors.push({
          id: `course_${course.id}`,
          values: embedding,
          metadata: {
            type: 'course',
            id: course.id,
            name: course.name,
            stream: course.stream,
            branch: course.branch,
            college_name: course.college_name,
          }
        });

        stats.courses++;

        // Rate limiting: 50ms delay between embeddings
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        console.error(`❌ Error processing course ${course.id}:`, error);
        stats.errors++;
      }
    }

    // Upload batch
    if (vectors.length > 0) {
      try {
        await uploadVectorsBatch(vectors);
        console.log(`✅ Uploaded batch ${Math.floor(i / BATCH_SIZE) + 1} (${vectors.length} courses)`);
      } catch (error) {
        console.error(`❌ Error uploading batch:`, error);
        stats.errors++;
      }
    }

    // Progress
    console.log(`Progress: ${Math.min(i + BATCH_SIZE, courses.length)}/${courses.length} courses`);
  }
}

/**
 * Process cutoffs and generate embeddings
 */
async function processCutoffs() {
  console.log('\n📊 Processing cutoffs...');

  const { data: cutoffs, error } = await supabase
    .from('cutoffs')
    .select('*')
    .limit(500); // Process first 500 cutoffs (they're verbose)

  if (error) {
    console.error('❌ Error fetching cutoffs:', error);
    return;
  }

  if (!cutoffs || cutoffs.length === 0) {
    console.log('⚠️  No cutoffs found in database');
    return;
  }

  console.log(`Found ${cutoffs.length} cutoffs`);

  // Process in batches
  for (let i = 0; i < cutoffs.length; i += BATCH_SIZE) {
    const batch = cutoffs.slice(i, i + BATCH_SIZE);
    const vectors = [];

    for (const cutoff of batch) {
      try {
        const text = getCutoffText(cutoff);
        const embedding = await generateEmbedding(text);

        vectors.push({
          id: `cutoff_${cutoff.id}`,
          values: embedding,
          metadata: {
            type: 'cutoff',
            id: cutoff.id,
            college_name: cutoff.college_name,
            course_name: cutoff.course_name,
            year: cutoff.year,
            category: cutoff.category,
            opening_rank: cutoff.opening_rank,
            closing_rank: cutoff.closing_rank,
          }
        });

        stats.cutoffs++;

        // Rate limiting: 50ms delay between embeddings
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        console.error(`❌ Error processing cutoff ${cutoff.id}:`, error);
        stats.errors++;
      }
    }

    // Upload batch
    if (vectors.length > 0) {
      try {
        await uploadVectorsBatch(vectors);
        console.log(`✅ Uploaded batch ${Math.floor(i / BATCH_SIZE) + 1} (${vectors.length} cutoffs)`);
      } catch (error) {
        console.error(`❌ Error uploading batch:`, error);
        stats.errors++;
      }
    }

    // Progress
    console.log(`Progress: ${Math.min(i + BATCH_SIZE, cutoffs.length)}/${cutoffs.length} cutoffs`);
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Starting embedding generation for NeetLogIQ');
  console.log(`📍 Vectorize Index: ${VECTORIZE_INDEX}`);
  console.log(`🔄 Batch Size: ${BATCH_SIZE}`);
  console.log(`🤖 Model: ${EMBEDDING_MODEL}`);
  console.log('');

  try {
    // Process all data types
    await processColleges();
    await processCourses();
    await processCutoffs();

    // Final stats
    const duration = ((Date.now() - stats.startTime) / 1000 / 60).toFixed(2);
    console.log('\n✨ Embedding generation complete!');
    console.log('═══════════════════════════════');
    console.log(`✅ Colleges: ${stats.colleges}`);
    console.log(`✅ Courses: ${stats.courses}`);
    console.log(`✅ Cutoffs: ${stats.cutoffs}`);
    console.log(`❌ Errors: ${stats.errors}`);
    console.log(`⏱️  Duration: ${duration} minutes`);
    console.log(`📊 Total vectors: ${stats.colleges + stats.courses + stats.cutoffs}`);
    console.log('═══════════════════════════════');
    console.log('');
    console.log('🎉 Your AI search is now ready!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Test search: visit /search on your site');
    console.log('2. Monitor usage in Cloudflare dashboard');
    console.log('3. Fine-tune relevance based on user feedback');

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
main();
