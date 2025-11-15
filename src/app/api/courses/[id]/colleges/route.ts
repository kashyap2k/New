/**
 * Course Colleges API
 * GET /api/courses/[id]/colleges - Get all colleges offering a specific course
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the course details first
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('*')
      .eq('id', id)
      .single();

    if (courseError || !course) {
      return NextResponse.json(
        { success: false, error: 'Course not found' },
        { status: 404 }
      );
    }

    // Find all colleges offering this course by matching course name
    // This assumes courses table has college_id or college_name field
    let collegesQuery = supabase
      .from('colleges')
      .select('*');

    // If course has college_id, use it
    if (course.college_id) {
      collegesQuery = collegesQuery.eq('id', course.college_id);
    }
    // Otherwise, try to match by college_name if available
    else if (course.college_name) {
      collegesQuery = collegesQuery.eq('name', course.college_name);
    }
    // Or find all courses with same name and get their colleges
    else {
      const { data: similarCourses } = await supabase
        .from('courses')
        .select('college_id, college_name')
        .eq('name', course.name);

      if (similarCourses && similarCourses.length > 0) {
        const collegeIds = similarCourses
          .map(c => c.college_id)
          .filter(Boolean);

        if (collegeIds.length > 0) {
          collegesQuery = collegesQuery.in('id', collegeIds);
        }
      }
    }

    const { data: colleges, error: collegesError } = await collegesQuery;

    if (collegesError) {
      console.error('Colleges query error:', collegesError);
      return NextResponse.json(
        { success: false, error: collegesError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: colleges || [],
      course: {
        id: course.id,
        name: course.name,
        stream: course.stream,
        branch: course.branch,
      },
    });

  } catch (error) {
    console.error('Course colleges API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch colleges',
        data: [],
      },
      { status: 500 }
    );
  }
}
