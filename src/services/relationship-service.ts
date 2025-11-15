/**
 * Relationship Service
 *
 * Handles graph traversal and relationship mapping using:
 * - Link tables (state_college_link, state_course_college_link)
 * - Foreign key relationships
 * - Cached relationship graphs
 *
 * Features:
 * - Multi-hop relationship traversal
 * - Cross-referencing across entities
 * - Optimized batch queries
 * - Relationship path finding
 */

import { createClient } from '@supabase/supabase-js';
import { resolveId, ResolutionOptions } from './id-resolver';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface RelationshipNode {
  id: string;
  type: 'college' | 'course' | 'cutoff' | 'state';
  name: string;
  metadata?: Record<string, any>;
}

export interface RelationshipEdge {
  from: string;
  to: string;
  type: 'offers' | 'has_cutoff' | 'located_in' | 'available_in';
  metadata?: Record<string, any>;
}

export interface RelationshipGraph {
  nodes: RelationshipNode[];
  edges: RelationshipEdge[];
  rootId: string;
  depth: number;
}

export interface TraversalOptions {
  maxDepth?: number;
  includeMetadata?: boolean;
  filterTypes?: Array<'college' | 'course' | 'cutoff' | 'state'>;
}

/**
 * Get complete relationship graph for an entity
 */
export async function getRelationshipGraph(
  id: string,
  type: 'college' | 'course' | 'cutoff' | 'state',
  options: TraversalOptions = {}
): Promise<RelationshipGraph> {
  const { maxDepth = 2, includeMetadata = true, filterTypes } = options;

  const graph: RelationshipGraph = {
    nodes: [],
    edges: [],
    rootId: id,
    depth: maxDepth,
  };

  const visited = new Set<string>();

  await traverseNode(id, type, 0, maxDepth, graph, visited, filterTypes, includeMetadata);

  return graph;
}

/**
 * Recursive graph traversal
 */
async function traverseNode(
  id: string,
  type: 'college' | 'course' | 'cutoff' | 'state',
  currentDepth: number,
  maxDepth: number,
  graph: RelationshipGraph,
  visited: Set<string>,
  filterTypes: string[] | undefined,
  includeMetadata: boolean
): Promise<void> {
  const nodeKey = `${type}:${id}`;

  if (visited.has(nodeKey) || currentDepth > maxDepth) return;
  visited.add(nodeKey);

  // Get node details
  const nodeData = await getNodeData(id, type, includeMetadata);
  if (!nodeData) return;

  // Add node to graph
  if (!filterTypes || filterTypes.includes(type)) {
    graph.nodes.push({
      id,
      type,
      name: nodeData.name,
      metadata: includeMetadata ? nodeData.metadata : undefined,
    });
  }

  // Get relationships and traverse
  const relationships = await getNodeRelationships(id, type);

  for (const rel of relationships) {
    // Add edge
    graph.edges.push({
      from: id,
      to: rel.targetId,
      type: rel.relationType,
      metadata: rel.metadata,
    });

    // Recursively traverse connected nodes
    if (currentDepth < maxDepth) {
      await traverseNode(
        rel.targetId,
        rel.targetType,
        currentDepth + 1,
        maxDepth,
        graph,
        visited,
        filterTypes,
        includeMetadata
      );
    }
  }
}

/**
 * Get node data from database
 */
async function getNodeData(
  id: string,
  type: string,
  includeMetadata: boolean
): Promise<{ name: string; metadata?: any } | null> {
  try {
    const tableName = getTableName(type);
    const selectFields = includeMetadata ? '*' : 'id, name';

    const { data, error } = await supabase
      .from(tableName)
      .select(selectFields)
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;

    return {
      name: data.name,
      metadata: includeMetadata ? data : undefined,
    };
  } catch (error) {
    console.error('Get node data error:', error);
    return null;
  }
}

/**
 * Get all relationships for a node
 */
async function getNodeRelationships(
  id: string,
  type: string
): Promise<
  Array<{
    targetId: string;
    targetType: 'college' | 'course' | 'cutoff' | 'state';
    relationType: 'offers' | 'has_cutoff' | 'located_in' | 'available_in';
    metadata?: any;
  }>
> {
  const relationships = [];

  if (type === 'college') {
    // College -> Courses
    const { data: courses } = await supabase
      .from('courses')
      .select('id, name, stream')
      .eq('college_id', id);

    if (courses) {
      relationships.push(
        ...courses.map(course => ({
          targetId: course.id,
          targetType: 'course' as const,
          relationType: 'offers' as const,
          metadata: { stream: course.stream },
        }))
      );
    }

    // College -> Cutoffs
    const { data: cutoffs } = await supabase
      .from('cutoffs')
      .select('id, year, category')
      .eq('college_id', id);

    if (cutoffs) {
      relationships.push(
        ...cutoffs.map(cutoff => ({
          targetId: cutoff.id,
          targetType: 'cutoff' as const,
          relationType: 'has_cutoff' as const,
          metadata: { year: cutoff.year, category: cutoff.category },
        }))
      );
    }

    // College -> States (via link table)
    const { data: states } = await supabase
      .from('state_college_link')
      .select('state_id, state')
      .eq('college_id', id);

    if (states) {
      relationships.push(
        ...states.map(state => ({
          targetId: state.state_id,
          targetType: 'state' as const,
          relationType: 'located_in' as const,
          metadata: { state_name: state.state },
        }))
      );
    }
  } else if (type === 'course') {
    // Course -> Colleges (via college_id)
    const { data: course } = await supabase
      .from('courses')
      .select('college_id')
      .eq('id', id)
      .maybeSingle();

    if (course?.college_id) {
      relationships.push({
        targetId: course.college_id,
        targetType: 'college' as const,
        relationType: 'offers' as const,
      });
    }

    // Course -> Cutoffs
    const { data: cutoffs } = await supabase
      .from('cutoffs')
      .select('id, year, category')
      .eq('course_id', id);

    if (cutoffs) {
      relationships.push(
        ...cutoffs.map(cutoff => ({
          targetId: cutoff.id,
          targetType: 'cutoff' as const,
          relationType: 'has_cutoff' as const,
          metadata: { year: cutoff.year, category: cutoff.category },
        }))
      );
    }

    // Course -> States (via link table)
    const { data: courseStates } = await supabase
      .from('state_course_college_link')
      .select('state_id, college_id')
      .eq('course_id', id);

    if (courseStates) {
      const uniqueStates = [...new Set(courseStates.map(cs => cs.state_id))];
      relationships.push(
        ...uniqueStates.map(stateId => ({
          targetId: stateId,
          targetType: 'state' as const,
          relationType: 'available_in' as const,
        }))
      );
    }
  } else if (type === 'state') {
    // State -> Colleges
    const { data: colleges } = await supabase
      .from('state_college_link')
      .select('college_id, college_name')
      .eq('state_id', id);

    if (colleges) {
      relationships.push(
        ...colleges.map(college => ({
          targetId: college.college_id,
          targetType: 'college' as const,
          relationType: 'located_in' as const,
          metadata: { college_name: college.college_name },
        }))
      );
    }

    // State -> Courses
    const { data: courses } = await supabase
      .from('state_course_college_link')
      .select('course_id, stream')
      .eq('state_id', id);

    if (courses) {
      const uniqueCourses = [...new Set(courses.map(c => c.course_id))];
      relationships.push(
        ...uniqueCourses.map(courseId => ({
          targetId: courseId,
          targetType: 'course' as const,
          relationType: 'available_in' as const,
        }))
      );
    }
  }

  return relationships;
}

/**
 * Find all colleges offering a specific course
 */
export async function getCollegesOfferingCourse(
  courseId: string,
  options: { state?: string; includeDetails?: boolean } = {}
): Promise<any[]> {
  try {
    let query = supabase
      .from('state_course_college_link')
      .select('college_id, state_id, stream, master_address')
      .eq('course_id', courseId);

    if (options.state) {
      query = query.eq('state_id', options.state);
    }

    const { data: links } = await query;
    if (!links || links.length === 0) return [];

    const uniqueCollegeIds = [...new Set(links.map(l => l.college_id))];

    if (!options.includeDetails) {
      return uniqueCollegeIds.map(id => ({ id }));
    }

    // Get full college details
    const { data: colleges } = await supabase
      .from('colleges')
      .select('*')
      .in('id', uniqueCollegeIds);

    return colleges || [];
  } catch (error) {
    console.error('Get colleges offering course error:', error);
    return [];
  }
}

/**
 * Find all courses offered in a state
 */
export async function getCoursesInState(
  stateId: string,
  options: { stream?: string; includeColleges?: boolean } = {}
): Promise<any[]> {
  try {
    let query = supabase
      .from('state_course_college_link')
      .select('course_id, stream, college_id')
      .eq('state_id', stateId);

    if (options.stream) {
      query = query.eq('stream', options.stream);
    }

    const { data: links } = await query;
    if (!links || links.length === 0) return [];

    const uniqueCourseIds = [...new Set(links.map(l => l.course_id))];

    if (!options.includeColleges) {
      return uniqueCourseIds.map(id => ({ id }));
    }

    // Get course details with college mapping
    const courseMap = new Map();
    for (const link of links) {
      if (!courseMap.has(link.course_id)) {
        courseMap.set(link.course_id, {
          courseId: link.course_id,
          stream: link.stream,
          colleges: [],
        });
      }
      courseMap.get(link.course_id).colleges.push(link.college_id);
    }

    return Array.from(courseMap.values());
  } catch (error) {
    console.error('Get courses in state error:', error);
    return [];
  }
}

/**
 * Find shortest path between two nodes
 */
export async function findRelationshipPath(
  fromId: string,
  fromType: 'college' | 'course' | 'cutoff' | 'state',
  toId: string,
  toType: 'college' | 'course' | 'cutoff' | 'state'
): Promise<RelationshipNode[] | null> {
  // BFS to find shortest path
  const queue: Array<{ id: string; type: string; path: RelationshipNode[] }> = [
    {
      id: fromId,
      type: fromType,
      path: [{ id: fromId, type: fromType, name: '' }],
    },
  ];

  const visited = new Set<string>([`${fromType}:${fromId}`]);

  while (queue.length > 0) {
    const current = queue.shift()!;

    // Found target
    if (current.id === toId && current.type === toType) {
      return current.path;
    }

    // Get relationships
    const relationships = await getNodeRelationships(current.id, current.type);

    for (const rel of relationships) {
      const key = `${rel.targetType}:${rel.targetId}`;
      if (!visited.has(key)) {
        visited.add(key);
        queue.push({
          id: rel.targetId,
          type: rel.targetType,
          path: [
            ...current.path,
            { id: rel.targetId, type: rel.targetType, name: '' },
          ],
        });
      }
    }

    // Limit search depth
    if (current.path.length > 5) break;
  }

  return null; // No path found
}

/**
 * Get cross-referenced entities
 * Example: Find all colleges in Karnataka offering MBBS
 */
export async function getCrossReferencedEntities(filters: {
  stateId?: string;
  courseId?: string;
  collegeId?: string;
  stream?: string;
}): Promise<{
  colleges: any[];
  courses: any[];
  states: any[];
}> {
  const results = {
    colleges: [] as any[],
    courses: [] as any[],
    states: [] as any[],
  };

  try {
    // Build query on state_course_college_link
    let query = supabase.from('state_course_college_link').select('*');

    if (filters.stateId) query = query.eq('state_id', filters.stateId);
    if (filters.courseId) query = query.eq('course_id', filters.courseId);
    if (filters.collegeId) query = query.eq('college_id', filters.collegeId);
    if (filters.stream) query = query.eq('stream', filters.stream);

    const { data: links } = await query;
    if (!links || links.length === 0) return results;

    // Extract unique IDs
    const collegeIds = [...new Set(links.map(l => l.college_id))];
    const courseIds = [...new Set(links.map(l => l.course_id))];
    const stateIds = [...new Set(links.map(l => l.state_id))];

    // Fetch entity details
    if (collegeIds.length > 0) {
      const { data: colleges } = await supabase
        .from('colleges')
        .select('*')
        .in('id', collegeIds);
      results.colleges = colleges || [];
    }

    if (courseIds.length > 0) {
      const { data: courses } = await supabase
        .from('master_courses')
        .select('*')
        .in('id', courseIds);
      results.courses = courses || [];
    }

    if (stateIds.length > 0) {
      const { data: states } = await supabase
        .from('states')
        .select('*')
        .in('id', stateIds);
      results.states = states || [];
    }

    return results;
  } catch (error) {
    console.error('Cross-reference query error:', error);
    return results;
  }
}

// ==================== HELPER FUNCTIONS ====================

function getTableName(type: string): string {
  const tableMap: Record<string, string> = {
    college: 'colleges',
    course: 'courses',
    cutoff: 'cutoffs',
    state: 'states',
  };
  return tableMap[type] || 'colleges';
}
