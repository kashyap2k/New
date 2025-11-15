/**
 * Recommendation Engine Service
 * Uses relationship graphs, user preferences, and trending data
 * to provide intelligent college and course recommendations
 *
 * Algorithms:
 * 1. Graph-based similarity (colleges with similar courses/cutoffs)
 * 2. Collaborative filtering (users who liked X also liked Y)
 * 3. Content-based filtering (similar attributes)
 * 4. Trending boost (popular colleges get higher scores)
 * 5. Personalized ranking (based on user preferences)
 */

import { createClient } from '@supabase/supabase-js';
import { getRelationshipGraph } from './relationship-service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Recommendation types
export type RecommendationType = 'college' | 'course';

// Recommendation context
export interface RecommendationContext {
  userId?: string;
  sourceId: string;
  sourceType: RecommendationType;
  limit?: number;
  includeReasons?: boolean;
}

// Recommendation result
export interface Recommendation {
  id: string;
  name: string;
  type: RecommendationType;
  score: number; // 0-100
  reasons: string[];
  metadata?: any;
}

// User preferences (can be extended)
export interface UserPreferences {
  preferredStates?: string[];
  preferredStreams?: string[];
  preferredManagement?: string[];
  maxFees?: number;
  minNIRFRank?: number;
}

/**
 * Get college recommendations based on a source college
 */
export async function getCollegeRecommendations(
  context: RecommendationContext
): Promise<Recommendation[]> {
  const { sourceId, userId, limit = 10, includeReasons = true } = context;

  // Step 1: Get source college details
  const { data: sourceCollege, error } = await supabase
    .from('colleges')
    .select('*')
    .eq('id', sourceId)
    .single();

  if (error || !sourceCollege) {
    return [];
  }

  // Step 2: Get relationship graph for similarity analysis
  const graph = await getRelationshipGraph(sourceId, 'college', {
    maxDepth: 2,
    includeMetadata: true,
  });

  // Step 3: Calculate recommendations from multiple sources
  const [
    graphSimilar,
    collaborativeFiltered,
    contentSimilar,
    trendingColleges,
    userPreferred,
  ] = await Promise.all([
    getGraphBasedSimilarity(sourceCollege, graph),
    getCollaborativeRecommendations(sourceId, userId),
    getContentBasedSimilarity(sourceCollege),
    getTrendingColleges(sourceCollege.state, sourceCollege.stream),
    userId ? getPersonalizedRecommendations(userId, sourceCollege) : Promise.resolve([]),
  ]);

  // Step 4: Merge and rank recommendations
  const merged = mergeRecommendations([
    { source: 'graph', weight: 0.3, recommendations: graphSimilar },
    { source: 'collaborative', weight: 0.25, recommendations: collaborativeFiltered },
    { source: 'content', weight: 0.2, recommendations: contentSimilar },
    { source: 'trending', weight: 0.15, recommendations: trendingColleges },
    { source: 'personalized', weight: 0.1, recommendations: userPreferred },
  ]);

  // Step 5: Filter out source college and limit results
  const filtered = merged
    .filter(rec => rec.id !== sourceId)
    .slice(0, limit);

  // Step 6: Enrich with reasons if requested
  if (includeReasons) {
    return await enrichWithReasons(filtered, sourceCollege);
  }

  return filtered;
}

/**
 * Get course recommendations based on a source course
 */
export async function getCourseRecommendations(
  context: RecommendationContext
): Promise<Recommendation[]> {
  const { sourceId, userId, limit = 10, includeReasons = true } = context;

  // Step 1: Get source course details
  const { data: sourceCourse, error } = await supabase
    .from('courses')
    .select('*')
    .eq('id', sourceId)
    .single();

  if (error || !sourceCourse) {
    return [];
  }

  // Step 2: Get relationship graph
  const graph = await getRelationshipGraph(sourceId, 'course', {
    maxDepth: 2,
    includeMetadata: true,
  });

  // Step 3: Calculate recommendations
  const [
    sameBranch,
    sameStream,
    sameCollege,
    popularCourses,
  ] = await Promise.all([
    getCoursesInSameBranch(sourceCourse),
    getCoursesInSameStream(sourceCourse),
    getCoursesInSameCollege(sourceCourse.college_id),
    getPopularCourses(sourceCourse.stream),
  ]);

  // Step 4: Merge and rank
  const merged = mergeRecommendations([
    { source: 'same_branch', weight: 0.35, recommendations: sameBranch },
    { source: 'same_stream', weight: 0.25, recommendations: sameStream },
    { source: 'same_college', weight: 0.2, recommendations: sameCollege },
    { source: 'popular', weight: 0.2, recommendations: popularCourses },
  ]);

  // Step 5: Filter and limit
  const filtered = merged
    .filter(rec => rec.id !== sourceId)
    .slice(0, limit);

  return filtered;
}

/**
 * Get personalized recommendations for a user
 */
export async function getPersonalizedRecommendationsForUser(
  userId: string,
  limit: number = 20
): Promise<Recommendation[]> {
  // Get user's favorite colleges
  const { data: favorites } = await supabase
    .from('favorites')
    .select('college_id')
    .eq('user_id', userId)
    .limit(5);

  if (!favorites || favorites.length === 0) {
    // Return trending colleges if no favorites
    return getTrendingColleges();
  }

  // Get recommendations based on each favorite
  const allRecommendations = await Promise.all(
    favorites.map(fav =>
      getCollegeRecommendations({
        sourceId: fav.college_id,
        sourceType: 'college',
        userId,
        limit: 10,
        includeReasons: false,
      })
    )
  );

  // Flatten and deduplicate
  const flatRecommendations = allRecommendations.flat();
  const uniqueMap = new Map<string, Recommendation>();

  for (const rec of flatRecommendations) {
    if (uniqueMap.has(rec.id)) {
      // Boost score if recommended multiple times
      const existing = uniqueMap.get(rec.id)!;
      existing.score = Math.min(100, existing.score + rec.score * 0.2);
    } else {
      uniqueMap.set(rec.id, rec);
    }
  }

  // Sort by score and limit
  return Array.from(uniqueMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Graph-based similarity (colleges with similar course offerings)
 */
async function getGraphBasedSimilarity(
  sourceCollege: any,
  graph: any
): Promise<Recommendation[]> {
  // Get courses from graph
  const sourceCourses = graph.nodes
    .filter((n: any) => n.type === 'course')
    .map((n: any) => n.id);

  if (sourceCourses.length === 0) {
    return [];
  }

  // Find colleges offering similar courses
  const { data: similarColleges } = await supabase
    .from('courses')
    .select('college_id, colleges(id, name, state, management_type)')
    .in('id', sourceCourses)
    .neq('college_id', sourceCollege.id)
    .limit(50);

  if (!similarColleges) return [];

  // Count course overlaps
  const collegeCounts = new Map<string, { college: any; count: number }>();

  for (const item of similarColleges) {
    const college = (item as any).colleges;
    if (!college) continue;

    if (collegeCounts.has(college.id)) {
      collegeCounts.get(college.id)!.count++;
    } else {
      collegeCounts.set(college.id, { college, count: 1 });
    }
  }

  // Calculate scores based on overlap
  const maxOverlap = Math.max(...Array.from(collegeCounts.values()).map(v => v.count));

  return Array.from(collegeCounts.values()).map(({ college, count }) => ({
    id: college.id,
    name: college.name,
    type: 'college' as RecommendationType,
    score: Math.round((count / maxOverlap) * 100),
    reasons: [`${count} courses in common`],
    metadata: college,
  }));
}

/**
 * Collaborative filtering (users who favorited X also favorited Y)
 */
async function getCollaborativeRecommendations(
  sourceId: string,
  userId?: string
): Promise<Recommendation[]> {
  // Get users who favorited the source college
  const { data: similarUsers } = await supabase
    .from('favorites')
    .select('user_id')
    .eq('college_id', sourceId)
    .limit(100);

  if (!similarUsers || similarUsers.length === 0) {
    return [];
  }

  const userIds = similarUsers.map(u => u.user_id);

  // Get what else these users favorited
  const { data: otherFavorites } = await supabase
    .from('favorites')
    .select('college_id, colleges(id, name, state, management_type)')
    .in('user_id', userIds)
    .neq('college_id', sourceId)
    .limit(100);

  if (!otherFavorites) return [];

  // Count occurrences
  const collegeCounts = new Map<string, { college: any; count: number }>();

  for (const item of otherFavorites) {
    const college = (item as any).colleges;
    if (!college) continue;

    if (collegeCounts.has(college.id)) {
      collegeCounts.get(college.id)!.count++;
    } else {
      collegeCounts.set(college.id, { college, count: 1 });
    }
  }

  // Calculate scores
  const maxCount = Math.max(...Array.from(collegeCounts.values()).map(v => v.count));

  return Array.from(collegeCounts.values())
    .map(({ college, count }) => ({
      id: college.id,
      name: college.name,
      type: 'college' as RecommendationType,
      score: Math.round((count / maxCount) * 100),
      reasons: [`${count} users also liked this`],
      metadata: college,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
}

/**
 * Content-based similarity (similar attributes)
 */
async function getContentBasedSimilarity(
  sourceCollege: any
): Promise<Recommendation[]> {
  // Find colleges with similar attributes
  let query = supabase
    .from('colleges')
    .select('id, name, state, city, management_type, stream, nirf_rank')
    .neq('id', sourceCollege.id)
    .eq('is_active', true);

  // Same state (higher weight)
  query = query.eq('state', sourceCollege.state);

  // Same stream
  if (sourceCollege.stream) {
    query = query.eq('stream', sourceCollege.stream);
  }

  // Similar NIRF rank (±50 ranks)
  if (sourceCollege.nirf_rank) {
    query = query
      .gte('nirf_rank', sourceCollege.nirf_rank - 50)
      .lte('nirf_rank', sourceCollege.nirf_rank + 50);
  }

  const { data: similar } = await query.limit(20);

  if (!similar) return [];

  // Calculate similarity scores
  return similar.map(college => {
    let score = 50; // Base score

    // Same state: +20
    if (college.state === sourceCollege.state) score += 20;

    // Same city: +15
    if (college.city === sourceCollege.city) score += 15;

    // Same management: +10
    if (college.management_type === sourceCollege.management_type) score += 10;

    // Similar NIRF rank: +5
    if (college.nirf_rank && sourceCollege.nirf_rank) {
      const rankDiff = Math.abs(college.nirf_rank - sourceCollege.nirf_rank);
      if (rankDiff <= 20) score += 5;
    }

    return {
      id: college.id,
      name: college.name,
      type: 'college' as RecommendationType,
      score: Math.min(100, score),
      reasons: [`Same state (${college.state})`],
      metadata: college,
    };
  });
}

/**
 * Get trending colleges (from materialized view if available)
 */
async function getTrendingColleges(
  state?: string,
  stream?: string
): Promise<Recommendation[]> {
  // Try materialized view first
  let query = supabase
    .from('mv_trending_colleges')
    .select('*')
    .order('trending_score', { ascending: false });

  if (state) {
    query = query.eq('state', state);
  }

  if (stream) {
    query = query.eq('stream', stream);
  }

  const { data: trending } = await query.limit(20);

  if (trending && trending.length > 0) {
    const maxScore = trending[0].trending_score;

    return trending.map(college => ({
      id: college.college_id,
      name: college.college_name,
      type: 'college' as RecommendationType,
      score: Math.round((college.trending_score / maxScore) * 100),
      reasons: [`${college.unique_favorites} users favorited recently`],
      metadata: college,
    }));
  }

  // Fallback to regular query if materialized view not available
  const { data: favoritesData } = await supabase
    .from('favorites')
    .select('college_id, colleges(id, name, state, stream)')
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .limit(100);

  if (!favoritesData) return [];

  const counts = new Map<string, { college: any; count: number }>();
  for (const item of favoritesData) {
    const college = (item as any).colleges;
    if (!college) continue;

    if (counts.has(college.id)) {
      counts.get(college.id)!.count++;
    } else {
      counts.set(college.id, { college, count: 1 });
    }
  }

  const maxCount = Math.max(...Array.from(counts.values()).map(v => v.count));

  return Array.from(counts.values())
    .map(({ college, count }) => ({
      id: college.id,
      name: college.name,
      type: 'college' as RecommendationType,
      score: Math.round((count / maxCount) * 100),
      reasons: [`Trending with ${count} recent favorites`],
      metadata: college,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
}

/**
 * Get personalized recommendations based on user preferences
 */
async function getPersonalizedRecommendations(
  userId: string,
  sourceCollege: any
): Promise<Recommendation[]> {
  // Get user profile/preferences
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('preferences')
    .eq('user_id', userId)
    .single();

  if (!profile || !profile.preferences) {
    return [];
  }

  const prefs = profile.preferences as any;

  // Build query based on preferences
  let query = supabase
    .from('colleges')
    .select('*')
    .eq('is_active', true)
    .neq('id', sourceCollege.id);

  if (prefs.preferredStates && prefs.preferredStates.length > 0) {
    query = query.in('state', prefs.preferredStates);
  }

  if (prefs.preferredStreams && prefs.preferredStreams.length > 0) {
    query = query.in('stream', prefs.preferredStreams);
  }

  if (prefs.preferredManagement && prefs.preferredManagement.length > 0) {
    query = query.in('management_type', prefs.preferredManagement);
  }

  const { data: preferred } = await query.limit(15);

  if (!preferred) return [];

  return preferred.map(college => ({
    id: college.id,
    name: college.name,
    type: 'college' as RecommendationType,
    score: 75, // Base score for matching preferences
    reasons: ['Matches your preferences'],
    metadata: college,
  }));
}

/**
 * Course recommendation helpers
 */
async function getCoursesInSameBranch(sourceCourse: any): Promise<Recommendation[]> {
  if (!sourceCourse.branch) return [];

  const { data: courses } = await supabase
    .from('courses')
    .select('id, name, stream, branch, total_seats')
    .eq('branch', sourceCourse.branch)
    .neq('id', sourceCourse.id)
    .limit(20);

  if (!courses) return [];

  return courses.map(course => ({
    id: course.id,
    name: course.name,
    type: 'course' as RecommendationType,
    score: 85,
    reasons: [`Same branch: ${course.branch}`],
    metadata: course,
  }));
}

async function getCoursesInSameStream(sourceCourse: any): Promise<Recommendation[]> {
  if (!sourceCourse.stream) return [];

  const { data: courses } = await supabase
    .from('courses')
    .select('id, name, stream, branch')
    .eq('stream', sourceCourse.stream)
    .neq('id', sourceCourse.id)
    .limit(20);

  if (!courses) return [];

  return courses.map(course => ({
    id: course.id,
    name: course.name,
    type: 'course' as RecommendationType,
    score: 70,
    reasons: [`Same stream: ${course.stream}`],
    metadata: course,
  }));
}

async function getCoursesInSameCollege(collegeId: string | null): Promise<Recommendation[]> {
  if (!collegeId) return [];

  const { data: courses } = await supabase
    .from('courses')
    .select('id, name, stream, total_seats')
    .eq('college_id', collegeId)
    .limit(15);

  if (!courses) return [];

  return courses.map(course => ({
    id: course.id,
    name: course.name,
    type: 'course' as RecommendationType,
    score: 80,
    reasons: ['Same college'],
    metadata: course,
  }));
}

async function getPopularCourses(stream?: string): Promise<Recommendation[]> {
  let query = supabase
    .from('courses')
    .select('id, name, stream, total_seats')
    .order('total_seats', { ascending: false });

  if (stream) {
    query = query.eq('stream', stream);
  }

  const { data: courses } = await query.limit(15);

  if (!courses) return [];

  const maxSeats = courses[0]?.total_seats || 1;

  return courses.map(course => ({
    id: course.id,
    name: course.name,
    type: 'course' as RecommendationType,
    score: Math.round((course.total_seats / maxSeats) * 100),
    reasons: [`${course.total_seats} seats available`],
    metadata: course,
  }));
}

/**
 * Merge recommendations from multiple sources with weighted scoring
 */
function mergeRecommendations(
  sources: Array<{
    source: string;
    weight: number;
    recommendations: Recommendation[];
  }>
): Recommendation[] {
  const merged = new Map<string, Recommendation>();

  for (const { source, weight, recommendations } of sources) {
    for (const rec of recommendations) {
      if (merged.has(rec.id)) {
        // Combine scores with weight
        const existing = merged.get(rec.id)!;
        existing.score += rec.score * weight;
        existing.reasons.push(...rec.reasons);
      } else {
        // Add new recommendation
        merged.set(rec.id, {
          ...rec,
          score: rec.score * weight,
        });
      }
    }
  }

  // Sort by final score
  return Array.from(merged.values())
    .sort((a, b) => b.score - a.score);
}

/**
 * Enrich recommendations with detailed reasons
 */
async function enrichWithReasons(
  recommendations: Recommendation[],
  sourceCollege: any
): Promise<Recommendation[]> {
  return recommendations.map(rec => {
    const reasons: string[] = [...new Set(rec.reasons)]; // Deduplicate

    // Add contextual reasons based on metadata
    if (rec.metadata) {
      if (rec.metadata.state === sourceCollege.state) {
        reasons.unshift(`Located in ${rec.metadata.state}`);
      }
      if (rec.metadata.management_type === sourceCollege.management_type) {
        reasons.push(`${rec.metadata.management_type} institution`);
      }
      if (rec.metadata.nirf_rank && rec.metadata.nirf_rank <= 100) {
        reasons.push(`NIRF Rank: ${rec.metadata.nirf_rank}`);
      }
    }

    return {
      ...rec,
      reasons: reasons.slice(0, 3), // Limit to top 3 reasons
    };
  });
}
