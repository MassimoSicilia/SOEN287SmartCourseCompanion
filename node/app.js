import express from 'express'
import cors from 'cors'
import sql from './db.js'

const app = express()
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUuid(value) {
  return uuidPattern.test(String(value).trim())
}

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
)
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.get('/health', async (req, res) => {
  try {
    const result = await sql`select now() as current_time`

    res.json({
      status: 'ok',
      service: 'smart-course-companion-api',
      database: 'connected',
      timestamp: result[0].current_time,
    })
  } catch (error) {
    res.status(503).json({
      status: 'error',
      service: 'smart-course-companion-api',
      database: 'disconnected',
      message: error.message,
    })
  }
})

app.get('/api', (req, res) => {
  res.json({
    message: 'Smart Course Companion backend is running.',
    endpoints: {
      health: '/health',
      courses: '/api/courses',
    },
  })
})

app.get('/api/courses', async (req, res) => {
  const enabledOnly = req.query.enabled !== 'false'

  try {
    const courses = await sql`
      select
        co.course_offering_id,
        co.course_code,
        co.course_name,
        co.section,
        co.instructor_name,
        co.is_enabled,
        co.created_at,
        co.updated_at,
        t.term_id,
        t.term_name,
        t.start_date,
        t.end_date,
        t.is_active,
        count(distinct a.assessment_id) as assessment_count,
        count(distinct e.enrollment_id) as enrollment_count
      from public.course_offerings co
      join public.terms t on t.term_id = co.term_id
      left join public.assessments a
        on a.course_offering_id = co.course_offering_id
        and a.is_published = true
      left join public.enrollments e
        on e.course_offering_id = co.course_offering_id
        and e.enrollment_status = 'active'
      where ${enabledOnly} = false or co.is_enabled = true
      group by
        co.course_offering_id,
        t.term_id
      order by
        t.start_date desc,
        co.course_code asc,
        co.section asc
    `

    res.json({
      count: courses.length,
      courses: courses.map((course) => ({
        courseOfferingId: course.course_offering_id,
        courseCode: course.course_code,
        courseName: course.course_name,
        section: course.section,
        instructorName: course.instructor_name,
        isEnabled: course.is_enabled,
        createdAt: course.created_at,
        updatedAt: course.updated_at,
        assessmentCount: Number(course.assessment_count ?? 0),
        enrollmentCount: Number(course.enrollment_count ?? 0),
        term: {
          termId: course.term_id,
          termName: course.term_name,
          startDate: course.start_date,
          endDate: course.end_date,
          isActive: course.is_active,
        },
      })),
    })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to load courses.',
      message: error.message,
    })
  }
})

app.get('/api/courses/:courseId', async (req, res) => {
  const { courseId } = req.params

  if (!isUuid(courseId)) {
    return res.status(400).json({
      error: 'Invalid course id.',
    })
  }

  try {
    const courseRows = await sql`
      select
        co.course_offering_id,
        co.course_code,
        co.course_name,
        co.section,
        co.instructor_name,
        co.is_enabled,
        co.created_at,
        co.updated_at,
        u.user_id as created_by_user_id,
        u.username as created_by_username,
        t.term_id,
        t.term_name,
        t.start_date,
        t.end_date,
        t.is_active
      from public.course_offerings co
      join public.terms t on t.term_id = co.term_id
      join public.users u on u.user_id = co.created_by_user_id
      where co.course_offering_id = ${courseId}
      limit 1
    `

    if (courseRows.length === 0) {
      return res.status(404).json({
        error: 'Course not found.',
      })
    }

    const course = courseRows[0]

    const summaryRows = await sql`
      select
        count(distinct a.assessment_id) as assessment_count,
        count(distinct e.enrollment_id) as enrollment_count
      from public.course_offerings co
      left join public.assessments a
        on a.course_offering_id = co.course_offering_id
        and a.is_published = true
      left join public.enrollments e
        on e.course_offering_id = co.course_offering_id
        and e.enrollment_status = 'active'
      where co.course_offering_id = ${courseId}
      group by co.course_offering_id
    `

    const summary = summaryRows[0] ?? {
      assessment_count: 0,
      enrollment_count: 0,
    }

    res.json({
      courseOfferingId: course.course_offering_id,
      courseCode: course.course_code,
      courseName: course.course_name,
      section: course.section,
      instructorName: course.instructor_name,
      isEnabled: course.is_enabled,
      createdAt: course.created_at,
      updatedAt: course.updated_at,
      assessmentCount: Number(summary.assessment_count ?? 0),
      enrollmentCount: Number(summary.enrollment_count ?? 0),
      createdBy: {
        userId: course.created_by_user_id,
        username: course.created_by_username,
      },
      term: {
        termId: course.term_id,
        termName: course.term_name,
        startDate: course.start_date,
        endDate: course.end_date,
        isActive: course.is_active,
      },
    })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to load course.',
      message: error.message,
    })
  }
})

app.get('/api/courses/:courseId/assignments', async (req, res) => {
  const { courseId } = req.params

  if (!isUuid(courseId)) {
    return res.status(400).json({
      error: 'Invalid course id.',
    })
  }

  try {
    const courseRows = await sql`
      select
        course_offering_id,
        course_code,
        course_name,
        section
      from public.course_offerings
      where course_offering_id = ${courseId}
      limit 1
    `

    if (courseRows.length === 0) {
      return res.status(404).json({
        error: 'Course not found.',
      })
    }

    const assignmentRows = await sql`
      select
        a.assessment_id,
        a.title,
        a.description,
        a.total_marks,
        a.weight_percent,
        a.due_date,
        a.is_published,
        a.display_order,
        ac.assessment_category_id,
        ac.category_name,
        ac.category_weight,
        ac.display_order as category_display_order
      from public.assessments a
      left join public.assessment_categories ac
        on ac.assessment_category_id = a.assessment_category_id
      where a.course_offering_id = ${courseId}
      order by
        coalesce(ac.display_order, 999999),
        a.display_order,
        a.due_date nulls last,
        a.title
    `

    res.json({
      course: {
        courseOfferingId: courseRows[0].course_offering_id,
        courseCode: courseRows[0].course_code,
        courseName: courseRows[0].course_name,
        section: courseRows[0].section,
      },
      count: assignmentRows.length,
      assignments: assignmentRows.map((assignment) => ({
        assessmentId: assignment.assessment_id,
        title: assignment.title,
        description: assignment.description,
        totalMarks: Number(assignment.total_marks),
        weightPercent: Number(assignment.weight_percent),
        dueDate: assignment.due_date,
        isPublished: assignment.is_published,
        displayOrder: assignment.display_order,
        category: assignment.assessment_category_id
          ? {
              assessmentCategoryId: assignment.assessment_category_id,
              categoryName: assignment.category_name,
              categoryWeight:
                assignment.category_weight === null
                  ? null
                  : Number(assignment.category_weight),
              displayOrder: assignment.category_display_order,
            }
          : null,
      })),
    })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to load assignments.',
      message: error.message,
    })
  }
})

app.use((req, res) => {
  res.status(404).json({
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  })
})

export default app
