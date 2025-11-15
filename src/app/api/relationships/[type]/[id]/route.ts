/**
 * Relationship Graph API
 * GET /api/relationships/{type}/{id} - Get full relationship graph for an entity
 *
 * Parameters:
 * - type: 'college' | 'course' | 'cutoff' | 'state'
 * - id: Entity ID
 *
 * Query Parameters:
 * - maxDepth: Maximum traversal depth (default: 2, max: 5)
 * - includeMetadata: Include full entity metadata (default: true)
 * - filterTypes: Comma-separated types to include (default: all)
 *
 * Response:
 * {
 *   success: true,
 *   graph: {
 *     nodes: Array<{ id, type, name, metadata? }>,
 *     edges: Array<{ from, to, type, metadata? }>,
 *     rootId: string,
 *     depth: number
 *   },
 *   stats: {
 *     totalNodes: number,
 *     totalEdges: number,
 *     nodesByType: Record<string, number>
 *   }
 * }
 *
 * Rate Limited: 100 requests/minute per IP
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRelationshipGraph } from '@/services/relationship-service';
import { standardRateLimit, addRateLimitHeaders } from '@/lib/rate-limit';

export async function GET(
  request: NextRequest,
  { params }: { params: { type: string; id: string } }
) {
  // Apply rate limiting
  const rateLimitResult = standardRateLimit.check(request);
  if (!rateLimitResult.success) {
    return addRateLimitHeaders(
      NextResponse.json({ success: false, error: rateLimitResult.error }, { status: 429 }),
      rateLimitResult
    );
  }

  try {
    const { type, id } = params;
    const searchParams = request.nextUrl.searchParams;

    // Validation
    if (!['college', 'course', 'cutoff', 'state'].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid type. Must be: college, course, cutoff, or state' },
        { status: 400 }
      );
    }

    // Parse options
    const maxDepth = Math.min(Number(searchParams.get('maxDepth')) || 2, 5);
    const includeMetadata = searchParams.get('includeMetadata') !== 'false';
    const filterTypesParam = searchParams.get('filterTypes');
    const filterTypes = filterTypesParam
      ? filterTypesParam.split(',').filter(t => ['college', 'course', 'cutoff', 'state'].includes(t))
      : undefined;

    // Get relationship graph
    const graph = await getRelationshipGraph(id, type as any, {
      maxDepth,
      includeMetadata,
      filterTypes: filterTypes as any,
    });

    // Calculate stats
    const nodesByType: Record<string, number> = {};
    for (const node of graph.nodes) {
      nodesByType[node.type] = (nodesByType[node.type] || 0) + 1;
    }

    const jsonResponse = NextResponse.json({
      success: true,
      graph,
      stats: {
        totalNodes: graph.nodes.length,
        totalEdges: graph.edges.length,
        nodesByType,
      },
    });

    return addRateLimitHeaders(jsonResponse, rateLimitResult);
  } catch (error) {
    console.error('Relationship graph error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch relationship graph',
      },
      { status: 500 }
    );
  }
}
