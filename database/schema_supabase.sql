CREATE EXTENSION IF NOT EXISTS pgcrypto;


//users table 
CREATE TABLE IF NOT EXISTS public.users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);
ALTER TABLE public.users DROP COLUMN IF EXISTS username;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_username_key;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_email_key;

UPDATE public.users
SET
  first_name = COALESCE(NULLIF(first_name, ''), 'User'),
  last_name = COALESCE(NULLIF(last_name, ''), 'User')
WHERE first_name IS NULL
   OR last_name IS NULL
   OR first_name = ''
   OR last_name = '';

ALTER TABLE public.users ALTER COLUMN first_name SET NOT NULL;
ALTER TABLE public.users ALTER COLUMN last_name SET NOT NULL;

//student_profiles table
CREATE TABLE IF NOT EXISTS public.student_profiles (
  student_profile_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(user_id) ON DELETE CASCADE,
  student_number VARCHAR(50) NOT NULL UNIQUE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL
);

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.users (user_id, first_name, last_name, email, role)
  VALUES (
    NEW.id,
    left(
      COALESCE(
        NULLIF(NEW.raw_user_meta_data ->> 'first_name', ''),
        split_part(NEW.email, '@', 1),
        'User'
      ),
      100
    ),
    left(
      COALESCE(
        NULLIF(NEW.raw_user_meta_data ->> 'last_name', ''),
        'User'
      ),
      100
    ),
    NEW.email,
    CASE
      WHEN COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'role', ''), 'student') = 'admin' THEN 'admin'
      ELSE 'student'
    END
  )
  ON CONFLICT (user_id) DO NOTHING;

  IF COALESCE(NEW.raw_user_meta_data ->> 'role', 'student') = 'student'
    AND NULLIF(NEW.raw_user_meta_data ->> 'student_id', '') IS NOT NULL THEN
    INSERT INTO public.student_profiles (
      user_id,
      student_number,
      first_name,
      last_name
    )
    VALUES (
      NEW.id,
      NEW.raw_user_meta_data ->> 'student_id',
      left(
        COALESCE(
          NULLIF(NEW.raw_user_meta_data ->> 'first_name', ''),
          split_part(NEW.email, '@', 1),
          'Student'
        ),
        100
      ),
      left(COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'last_name', ''), 'Student'), 100)
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.users (user_id, first_name, last_name, email, role)
SELECT
  au.id,
  left(
    COALESCE(
      NULLIF(au.raw_user_meta_data ->> 'first_name', ''),
      split_part(au.email, '@', 1),
      'User'
    ),
    100
  ),
  left(
    COALESCE(
      NULLIF(au.raw_user_meta_data ->> 'last_name', ''),
      'User'
    ),
    100
  ),
  au.email,
  CASE
    WHEN COALESCE(NULLIF(au.raw_user_meta_data ->> 'role', ''), 'student') = 'admin' THEN 'admin'
    ELSE 'student'
  END
FROM auth.users au
ON CONFLICT (user_id) DO NOTHING;

DO $$
BEGIN
  INSERT INTO public.student_profiles (
    user_id,
    student_number,
    first_name,
    last_name
  )
  SELECT
    au.id,
    au.raw_user_meta_data ->> 'student_id',
    left(
      COALESCE(
        NULLIF(au.raw_user_meta_data ->> 'first_name', ''),
        split_part(au.email, '@', 1),
        'Student'
      ),
      100
    ),
    left(COALESCE(NULLIF(au.raw_user_meta_data ->> 'last_name', ''), 'Student'), 100)
  FROM auth.users au
  WHERE COALESCE(au.raw_user_meta_data ->> 'role', 'student') = 'student'
    AND NULLIF(au.raw_user_meta_data ->> 'student_id', '') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.student_profiles existing_profiles
      WHERE existing_profiles.student_number = au.raw_user_meta_data ->> 'student_id'
        AND existing_profiles.user_id <> au.id
    )
  ON CONFLICT (user_id) DO NOTHING;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'student_profiles backfill skipped: %', SQLERRM;
END
$$;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS "users can insert own profile" ON public.users;
CREATE POLICY "users can insert own profile"
  ON public.users
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

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

DROP POLICY IF EXISTS "students can insert own profile details" ON public.student_profiles;
CREATE POLICY "students can insert own profile details"
  ON public.student_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_student_profiles_user_id
  ON public.student_profiles(user_id);

//available_courses table
CREATE TABLE IF NOT EXISTS public.available_courses (
  course_offering_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_code VARCHAR(20) NOT NULL,
  course_name VARCHAR(255) NOT NULL,
  section VARCHAR(20) NOT NULL,
  instructor_name VARCHAR(255) NOT NULL,
  credits INT NOT NULL CHECK (credits > 0),
  term VARCHAR(50) NOT NULL,
  created_by_user_id UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.available_courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins can read own available courses" ON public.available_courses;
CREATE POLICY "admins can read own available courses"
  ON public.available_courses
  FOR SELECT
  TO authenticated
  USING (
    created_by_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.users
      WHERE user_id = auth.uid()
        AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "admins can insert own available courses" ON public.available_courses;
CREATE POLICY "admins can insert own available courses"
  ON public.available_courses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.users
      WHERE user_id = auth.uid()
        AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "admins can update own available courses" ON public.available_courses;
CREATE POLICY "admins can update own available courses"
  ON public.available_courses
  FOR UPDATE
  TO authenticated
  USING (
    created_by_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.users
      WHERE user_id = auth.uid()
        AND role = 'admin'
    )
  )
  WITH CHECK (
    created_by_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.users
      WHERE user_id = auth.uid()
        AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "admins can delete own available courses" ON public.available_courses;
CREATE POLICY "admins can delete own available courses"
  ON public.available_courses
  FOR DELETE
  TO authenticated
  USING (
    created_by_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.users
      WHERE user_id = auth.uid()
        AND role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_available_courses_created_by_user_id
  ON public.available_courses(created_by_user_id);

CREATE INDEX IF NOT EXISTS idx_available_courses_is_enabled
  ON public.available_courses(is_enabled);

ALTER TABLE public.assessments
  DROP CONSTRAINT IF EXISTS assessments_course_offering_id_fkey;

ALTER TABLE public.assessments
  ADD CONSTRAINT assessments_course_offering_id_fkey
  FOREIGN KEY (course_offering_id)
  REFERENCES public.available_courses(course_offering_id)
  ON DELETE CASCADE;

ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated users can read assessments" ON public.assessments;
CREATE POLICY "authenticated users can read assessments"
  ON public.assessments
  FOR SELECT
  TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "admins can manage own course assessments" ON public.assessments;
CREATE POLICY "admins can manage own course assessments"
  ON public.assessments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.available_courses ac
      JOIN public.users u
        ON u.user_id = auth.uid()
      WHERE ac.course_offering_id = assessments.course_offering_id
        AND ac.created_by_user_id = auth.uid()
        AND u.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.available_courses ac
      JOIN public.users u
        ON u.user_id = auth.uid()
      WHERE ac.course_offering_id = assessments.course_offering_id
        AND ac.created_by_user_id = auth.uid()
        AND u.role = 'admin'
    )
  );

CREATE TABLE IF NOT EXISTS public.course_templates (
  course_template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name VARCHAR(255) NOT NULL,
  template_description TEXT NOT NULL DEFAULT '',
  created_by_user_id UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.student_course_enrollments (
  user_id UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  course_offering_id UUID NOT NULL REFERENCES public.available_courses(course_offering_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, course_offering_id)
);

CREATE TABLE IF NOT EXISTS public.student_assessment_progress (
  user_id UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  course_offering_id UUID NOT NULL REFERENCES public.available_courses(course_offering_id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES public.assessments(assessment_id) ON DELETE CASCADE,
  grade VARCHAR(20) NOT NULL DEFAULT '',
  status VARCHAR(30) NOT NULL DEFAULT 'Not started',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, course_offering_id, assessment_id)
);
