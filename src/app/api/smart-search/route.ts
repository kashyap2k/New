/**
 * Smart Search API
 * POST /api/smart-search - Intelligent search with auto-linking
 *
 * Features:
 * - Smart ID resolution (handles IDs or names)
 * - Auto-linking of related entities
 * - Graph traversal for comprehensive results
 * - Fuzzy matching for typos
 * - Cross-referencing across colleges/courses/cutoffs
 *
 * Request Body:
 * {
 *   query: string,
 *   type: 'college' | 'course' | 'state',
 *   options?: {
 *     includeRelated?: boolean,
 *     maxDepth?: number,
 *     fuzzyThreshold?: number,
 *     autoLink?: boolean
 *   }
 * }
 *
 * Response:
 * {
 *   success: true,
 *   match: {
 *     id: string,
 *     name: string,
 *     type: string,
 *     confidence: number,
 *     method: 'direct' | 'composite' | 'fuzzy' | 'link_table'
 *   },
 *   entity: { full entity details },
 *   related?: {
 *     colleges: Array,
 *     courses: Array,
 *     states: Array,
 *     cutoffs: Array
 *   },
 *   graph?: RelationshipGraph,
 *   suggestions?: Array<{ id, name, confidence }>
 * }
 *
 * Rate Limited: 100 requests/minute per IP
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolveId, resolveBatchIds } from '@/services/id-resolver';
import {
  getRelationshipGraph,
  getCrossReferencedEntities,
  getCollegesOfferingCourse,
  getCoursesInState,
} from '@/services/relationship-service';
import { createClient } from '@supabase/supabase-js';
import { standardRateLimit, addRateLimitHeaders } from '@/lib/rate-limit';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResult = standardRateLimit.check(request);
  if (!rateLimitResult.success) {
    return addRateLimitHeaders(
      NextResponse.json({ success: false, error: rateLimitResult.error }, { status: 429 }),
      rateLimitResult
    );
  }

  try {
    const body = await request.json();
    const {
      query,
      type,
      options = {},
    } = body;

    // Validate input
    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Query parameter is required and must be a string' },
        { status: 400 }
      );
    }

    if (!type || !['college', 'course', 'state'].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Type must be one of: college, course, state' },
        { status: 400 }
      );
    }

    const {
      includeRelated = true,
      maxDepth = 2,
      fuzzyThreshold = 0.7,
      autoLink = true,
    } = options;

    // Step 1: Resolve the identifier using smart ID resolution
    const resolutionResult = await resolveId(query, {
      type: type as 'college' | 'course' | 'state',
      fuzzyThreshold,
      useCache: true,
    });

    if (!resolutionResult.id) {
      // Try to find similar matches
      const suggestions = await findSimilarMatches(query, type, fuzzyThreshold);

      return addRateLimitHeaders(
        NextResponse.json({
          success: false,
          error: 'Entity not found',
          query,
          type,
          suggestions,
          hint: suggestions.length > 0 ? 'Did you mean one of these?' : 'Try adjusting your search query',
        }),
        rateLimitResult
      );
    }

    // Step 2: Fetch full entity details
    const entity = await fetchEntityDetails(resolutionResult.id, type);

    if (!entity) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch entity details' },
        { status: 500 }
      );
    }

    // Step 3: Build comprehensive response
    const response: any = {
      success: true,
      match: {
        id: resolutionResult.id,
        name: resolutionResult.name,
        type: resolutionResult.type,
        confidence: resolutionResult.confidence,
        method: resolutionResult.method,
      },
      entity,
    };

    // Step 4: Auto-link related entities if requested
    if (autoLink && includeRelated) {
      response.related = await fetchRelatedEntities(resolutionResult.id, type);
    }

    // Step 5: Build relationship graph if depth > 0
    if (maxDepth > 0) {
      const graph = await getRelationshipGraph(
        resolutionResult.id,
        type as 'college' | 'course' | 'state',
        {
          maxDepth: Math.min(maxDepth, 3), // Cap at 3 for performance
          includeMetadata: true,
        }
      );

      response.graph = {
        nodes: graph.nodes,
        edges: graph.edges,
        stats: {
          totalNodes: graph.nodes.length,
          totalEdges: graph.edges.length,
          depth: graph.depth,
        },
      };
    }

    // Step 6: Add search metadata
    response.metadata = {
      searchQuery: query,
      searchType: type,
      resolutionMethod: resolutionResult.method,
      confidence: resolutionResult.confidence,
      autoLinked: autoLink && includeRelated,
      graphDepth: maxDepth > 0 ? Math.min(maxDepth, 3) : 0,
    };

    const jsonResponse = NextResponse.json(response);
    return addRateLimitHeaders(jsonResponse, rateLimitResult);
  } catch (error) {
    console.error('Smart search error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Smart search failed',
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for simple searches
 */
export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResult = standardRateLimit.check(request);
  if (!rateLimitResult.success) {
    return addRateLimitHeaders(
      NextResponse.json({ success: false, error: rateLimitResult.error }, { status: 429 }),
      rateLimitResult
    );
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || searchParams.get('query');
    const type = searchParams.get('type');
    const includeRelated = searchParams.get('includeRelated') !== 'false';
    const maxDepth = Math.min(Number(searchParams.get('maxDepth')) || 1, 3);

    if (!query) {
      return NextResponse.json(
        { success: false, error: 'Query parameter (q or query) is required' },
        { status: 400 }
      );
    }

    if (!type || !['college', 'course', 'state'].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Type must be one of: college, course, state' },
        { status: 400 }
      );
    }

    // Use POST handler logic
    return POST(
      new NextRequest(request.url, {
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify({
          query,
          type,
          options: { includeRelated, maxDepth },
        }),
      })
    );
  } catch (error) {
    console.error('Smart search GET error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Smart search failed',
      },
      { status: 500 }
    );
  }
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Fetch full entity details from database
 */
async function fetchEntityDetails(id: string, type: string): Promise<any | null> {
  try {
    const tableName = getTableName(type);
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Fetch entity error:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Fetch entity details error:', error);
    return null;
  }
}

/**
 * Fetch related entities for auto-linking
 */
async function fetchRelatedEntities(
  id: string,
  type: string
): Promise<{
  colleges?: any[];
  courses?: any[];
  states?: any[];
  cutoffs?: any[];
}> {
  const related: any = {};

  try {
    if (type === 'college') {
      // Fetch related courses
      const { data: courses } = await supabase
        .from('courses')
        .select('*')
        .eq('college_id', id)
        .limit(50);

      related.courses = courses || [];

      // Fetch related cutoffs
      const { data: cutoffs } = await supabase
        .from('cutoffs')
        .select('*')
        .eq('college_id', id)
        .limit(100);

      related.cutoffs = cutoffs || [];

      // Fetch related states
      const { data: stateLinks } = await supabase
        .from('state_college_link')
        .select('state_id, state')
        .eq('college_id', id);

      if (stateLinks && stateLinks.length > 0) {
        const stateIds = [...new Set(stateLinks.map(s => s.state_id))];
        const { data: states } = await supabase
          .from('states')
          .select('*')
          .in('id', stateIds);

        related.states = states || [];
      }
    } else if (type === 'course') {
      // Fetch colleges offering this course
      const colleges = await getCollegesOfferingCourse(id, { includeDetails: true });
      related.colleges = colleges;

      // Fetch related cutoffs
      const { data: cutoffs } = await supabase
        .from('cutoffs')
        .select('*')
        .eq('course_id', id)
        .limit(100);

      related.cutoffs = cutoffs || [];

      // Fetch related states
      const { data: courseLinks } = await supabase
        .from('state_course_college_link')
        .select('state_id')
        .eq('course_id', id);

      if (courseLinks && courseLinks.length > 0) {
        const stateIds = [...new Set(courseLinks.map(c => c.state_id))];
        const { data: states } = await supabase
          .from('states')
          .select('*')
          .in('id', stateIds);

        related.states = states || [];
      }
    } else if (type === 'state') {
      // Fetch colleges in this state
      const { data: collegeLinks } = await supabase
        .from('state_college_link')
        .select('college_id')
        .eq('state_id', id);

      if (collegeLinks && collegeLinks.length > 0) {
        const collegeIds = [...new Set(collegeLinks.map(c => c.college_id))];
        const { data: colleges } = await supabase
          .from('colleges')
          .select('*')
          .in('id', collegeIds)
          .limit(100);

        related.colleges = colleges || [];
      }

      // Fetch courses in this state
      const courses = await getCoursesInState(id, { includeColleges: false });
      if (courses.length > 0) {
        const courseIds = courses.map(c => c.id);
        const { data: coursesDetails } = await supabase
          .from('master_courses')
          .select('*')
          .in('id', courseIds)
          .limit(100);

        related.courses = coursesDetails || [];
      }
    }

    return related;
  } catch (error) {
    console.error('Fetch related entities error:', error);
    return {};
  }
}

/**
 * Find similar matches for suggestions
 */
async function findSimilarMatches(
  query: string,
  type: string,
  threshold: number = 0.5
): Promise<Array<{ id: string; name: string; confidence: number }>> {
  try {
    const tableName = getTableName(type);

    // Try fuzzy search using ILIKE
    const { data } = await supabase
      .from(tableName)
      .select('id, name')
      .ilike('name', `%${query}%`)
      .limit(5);

    if (!data || data.length === 0) return [];

    // Calculate simple similarity score
    return data.map(item => ({
      id: item.id,
      name: item.name,
      confidence: calculateSimpleSimilarity(query.toLowerCase(), item.name.toLowerCase()),
    })).filter(item => item.confidence >= threshold)
      .sort((a, b) => b.confidence - a.confidence);
  } catch (error) {
    console.error('Find similar matches error:', error);
    return [];
  }
}

/**
 * Calculate simple string similarity
 */
function calculateSimpleSimilarity(str1: string, str2: string): number {
  // Simple substring matching
  if (str2.includes(str1)) return 0.9;
  if (str1.includes(str2)) return 0.85;

  // Word overlap
  const words1 = str1.split(/\s+/);
  const words2 = str2.split(/\s+/);
  const overlap = words1.filter(w => words2.some(w2 => w2.includes(w) || w.includes(w2)));

  return Math.min(0.8, (overlap.length / Math.max(words1.length, words2.length)) * 0.8);
}

/**
 * Get table name from entity type
 */
function getTableName(type: string): string {
  const tableMap: Record<string, string> = {
    college: 'colleges',
    course: 'master_courses',
    state: 'states',
  };
  return tableMap[type] || 'colleges';
}
