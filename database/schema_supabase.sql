CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.student_profiles (
  student_profile_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(user_id) ON DELETE CASCADE,
  student_number VARCHAR(50) NOT NULL UNIQUE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  program VARCHAR(150),
  faculty VARCHAR(150)
);

CREATE TABLE IF NOT EXISTS public.terms (
  term_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term_name VARCHAR(100) NOT NULL UNIQUE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS public.course_offerings (
  course_offering_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_code VARCHAR(20) NOT NULL,
  course_name VARCHAR(255) NOT NULL,
  section VARCHAR(20) NOT NULL,
  instructor_name VARCHAR(255) NOT NULL,
  term_id UUID NOT NULL REFERENCES public.terms(term_id) ON DELETE RESTRICT,
  created_by_user_id UUID NOT NULL REFERENCES public.users(user_id) ON DELETE RESTRICT,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (course_code, section, term_id)
);

CREATE TABLE IF NOT EXISTS public.enrollments (
  enrollment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  course_offering_id UUID NOT NULL REFERENCES public.course_offerings(course_offering_id) ON DELETE CASCADE,
  enrollment_status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (enrollment_status IN ('active', 'dropped', 'completed')),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_user_id, course_offering_id)
);

CREATE TABLE IF NOT EXISTS public.assessment_categories (
  assessment_category_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_offering_id UUID NOT NULL REFERENCES public.course_offerings(course_offering_id) ON DELETE CASCADE,
  category_name VARCHAR(100) NOT NULL,
  category_weight NUMERIC(5,2),
  display_order INT NOT NULL DEFAULT 1,
  CHECK (category_weight IS NULL OR (category_weight >= 0 AND category_weight <= 100)),
  UNIQUE (course_offering_id, category_name)
);

CREATE TABLE IF NOT EXISTS public.assessments (
  assessment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_offering_id UUID NOT NULL REFERENCES public.course_offerings(course_offering_id) ON DELETE CASCADE,
  assessment_category_id UUID REFERENCES public.assessment_categories(assessment_category_id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  total_marks NUMERIC(8,2) NOT NULL CHECK (total_marks > 0),
  weight_percent NUMERIC(5,2) NOT NULL CHECK (weight_percent >= 0 AND weight_percent <= 100),
  due_date TIMESTAMPTZ,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INT NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS public.student_assessment_scores (
  student_assessment_score_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.assessments(assessment_id) ON DELETE CASCADE,
  student_user_id UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  earned_marks NUMERIC(8,2) CHECK (earned_marks IS NULL OR earned_marks >= 0),
  progress_status VARCHAR(20) NOT NULL DEFAULT 'not_started'
    CHECK (progress_status IN ('not_started', 'in_progress', 'submitted', 'graded')),
  submitted_at TIMESTAMPTZ,
  graded_at TIMESTAMPTZ,
  notes TEXT,
  UNIQUE (assessment_id, student_user_id)
);

CREATE TABLE IF NOT EXISTS public.course_templates (
  course_template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name VARCHAR(255) NOT NULL UNIQUE,
  template_description TEXT,
  created_by_user_id UUID NOT NULL REFERENCES public.users(user_id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS public.course_template_assessments (
  course_template_assessment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_template_id UUID NOT NULL REFERENCES public.course_templates(course_template_id) ON DELETE CASCADE,
  category_name VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  total_marks NUMERIC(8,2) NOT NULL CHECK (total_marks > 0),
  weight_percent NUMERIC(5,2) NOT NULL CHECK (weight_percent >= 0 AND weight_percent <= 100),
  default_due_offset_days INT,
  display_order INT NOT NULL DEFAULT 1
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (user_id, username, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'student')
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_assessment_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_template_assessments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users can read own profile" ON public.users;
CREATE POLICY "users can read own profile"
  ON public.users
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users can update own profile" ON public.users;
CREATE POLICY "users can update own profile"
  ON public.users
  FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "students can read own profile details" ON public.student_profiles;
CREATE POLICY "students can read own profile details"
  ON public.student_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "students can manage own profile details" ON public.student_profiles;
CREATE POLICY "students can manage own profile details"
  ON public.student_profiles
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "authenticated users can read terms" ON public.terms;
CREATE POLICY "authenticated users can read terms"
  ON public.terms
  FOR SELECT
  TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "authenticated users can read courses" ON public.course_offerings;
CREATE POLICY "authenticated users can read courses"
  ON public.course_offerings
  FOR SELECT
  TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "authenticated users can read categories" ON public.assessment_categories;
CREATE POLICY "authenticated users can read categories"
  ON public.assessment_categories
  FOR SELECT
  TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "authenticated users can read assessments" ON public.assessments;
CREATE POLICY "authenticated users can read assessments"
  ON public.assessments
  FOR SELECT
  TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "students can read own enrollments" ON public.enrollments;
CREATE POLICY "students can read own enrollments"
  ON public.enrollments
  FOR SELECT
  USING (auth.uid() = student_user_id);

DROP POLICY IF EXISTS "students can manage own enrollments" ON public.enrollments;
CREATE POLICY "students can manage own enrollments"
  ON public.enrollments
  FOR ALL
  USING (auth.uid() = student_user_id)
  WITH CHECK (auth.uid() = student_user_id);

DROP POLICY IF EXISTS "students can read own scores" ON public.student_assessment_scores;
CREATE POLICY "students can read own scores"
  ON public.student_assessment_scores
  FOR SELECT
  USING (auth.uid() = student_user_id);

DROP POLICY IF EXISTS "students can manage own scores" ON public.student_assessment_scores;
CREATE POLICY "students can manage own scores"
  ON public.student_assessment_scores
  FOR ALL
  USING (auth.uid() = student_user_id)
  WITH CHECK (auth.uid() = student_user_id);

DROP POLICY IF EXISTS "admins can manage terms" ON public.terms;
CREATE POLICY "admins can manage terms"
  ON public.terms
  FOR ALL
  USING (EXISTS (
    SELECT 1
    FROM public.users
    WHERE user_id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public.users
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

DROP POLICY IF EXISTS "admins can manage courses" ON public.course_offerings;
CREATE POLICY "admins can manage courses"
  ON public.course_offerings
  FOR ALL
  USING (EXISTS (
    SELECT 1
    FROM public.users
    WHERE user_id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public.users
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

DROP POLICY IF EXISTS "admins can manage categories" ON public.assessment_categories;
CREATE POLICY "admins can manage categories"
  ON public.assessment_categories
  FOR ALL
  USING (EXISTS (
    SELECT 1
    FROM public.users
    WHERE user_id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public.users
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

DROP POLICY IF EXISTS "admins can manage assessments" ON public.assessments;
CREATE POLICY "admins can manage assessments"
  ON public.assessments
  FOR ALL
  USING (EXISTS (
    SELECT 1
    FROM public.users
    WHERE user_id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public.users
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

DROP POLICY IF EXISTS "admins can manage templates" ON public.course_templates;
CREATE POLICY "admins can manage templates"
  ON public.course_templates
  FOR ALL
  USING (EXISTS (
    SELECT 1
    FROM public.users
    WHERE user_id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public.users
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

DROP POLICY IF EXISTS "admins can manage template assessments" ON public.course_template_assessments;
CREATE POLICY "admins can manage template assessments"
  ON public.course_template_assessments
  FOR ALL
  USING (EXISTS (
    SELECT 1
    FROM public.users
    WHERE user_id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public.users
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

CREATE INDEX IF NOT EXISTS idx_student_profiles_user_id
  ON public.student_profiles(user_id);

CREATE INDEX IF NOT EXISTS idx_course_offerings_term_id
  ON public.course_offerings(term_id);

CREATE INDEX IF NOT EXISTS idx_course_offerings_created_by_user_id
  ON public.course_offerings(created_by_user_id);

CREATE INDEX IF NOT EXISTS idx_enrollments_student_user_id
  ON public.enrollments(student_user_id);

CREATE INDEX IF NOT EXISTS idx_enrollments_course_offering_id
  ON public.enrollments(course_offering_id);

CREATE INDEX IF NOT EXISTS idx_assessment_categories_course_offering_id
  ON public.assessment_categories(course_offering_id);

CREATE INDEX IF NOT EXISTS idx_assessments_course_offering_id
  ON public.assessments(course_offering_id);

CREATE INDEX IF NOT EXISTS idx_assessments_assessment_category_id
  ON public.assessments(assessment_category_id);

CREATE INDEX IF NOT EXISTS idx_student_assessment_scores_student_user_id
  ON public.student_assessment_scores(student_user_id);

CREATE INDEX IF NOT EXISTS idx_student_assessment_scores_assessment_id
  ON public.student_assessment_scores(assessment_id);

CREATE INDEX IF NOT EXISTS idx_course_templates_created_by_user_id
  ON public.course_templates(created_by_user_id);

CREATE INDEX IF NOT EXISTS idx_course_template_assessments_course_template_id
  ON public.course_template_assessments(course_template_id);
