import "dotenv/config";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
const sql = postgres(connectionString);

export async function initializeDatabase() {
  await sql`
    CREATE TABLE IF NOT EXISTS public.course_templates (
      course_template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      template_name VARCHAR(255) NOT NULL,
      template_description TEXT NOT NULL DEFAULT '',
      created_by_user_id UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (created_by_user_id, template_name)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS public.student_course_enrollments (
      user_id UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
      course_offering_id UUID NOT NULL REFERENCES public.available_courses(course_offering_id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, course_offering_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS public.student_assessment_progress (
      user_id UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
      course_offering_id UUID NOT NULL REFERENCES public.available_courses(course_offering_id) ON DELETE CASCADE,
      assessment_id UUID NOT NULL REFERENCES public.assessments(assessment_id) ON DELETE CASCADE,
      grade VARCHAR(20) NOT NULL DEFAULT '',
      status VARCHAR(30) NOT NULL DEFAULT 'Not started',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, course_offering_id, assessment_id)
    )
  `;
}

export default sql;
