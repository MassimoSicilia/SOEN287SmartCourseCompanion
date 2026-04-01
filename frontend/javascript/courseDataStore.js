const COURSE_TEMPLATE_STORAGE_KEY = "smartCourseTemplates";
const STUDENT_ENROLLMENT_STORAGE_KEY = "smartStudentEnrollments";
const STUDENT_PROGRESS_STORAGE_KEY = "smartStudentAssessmentProgress";

function readJsonStorage(storageKey, fallbackValue) {
  try {
    const rawValue = window.localStorage.getItem(storageKey);
    if (!rawValue) {
      return fallbackValue;
    }

    const parsedValue = JSON.parse(rawValue);
    return parsedValue ?? fallbackValue;
  } catch (error) {
    console.error(`Unable to parse localStorage key ${storageKey}:`, error);
    return fallbackValue;
  }
}

function writeJsonStorage(storageKey, value) {
  window.localStorage.setItem(storageKey, JSON.stringify(value));
}

function createAssessmentId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const randomValue = Math.floor(Math.random() * 16);
    const nextValue = char === "x" ? randomValue : (randomValue & 0x3) | 0x8;
    return nextValue.toString(16);
  });
}

function normalizeDateOnly(value) {
  const trimmedValue = String(value || "").trim();
  const dateOnlyMatch = trimmedValue.match(/^(\d{4}-\d{2}-\d{2})/);
  return dateOnlyMatch ? dateOnlyMatch[1] : trimmedValue;
}

function normalizeWeightValue(value) {
  const rawValue = String(value ?? "").trim();
  if (!rawValue) {
    return "";
  }

  return rawValue.endsWith("%") ? rawValue : `${rawValue}%`;
}

function parseWeightNumber(value) {
  const rawValue = String(value ?? "").replace("%", "").trim();
  const numericValue = Number(rawValue);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function normalizeAssessment(assessment) {
  return {
    id: assessment?.id || assessment?.assessment_id || createAssessmentId(),
    name: String(
      assessment?.name || assessment?.assessment_name || assessment?.title || "",
    ).trim(),
    weight: normalizeWeightValue(
      assessment?.weight ?? assessment?.weight_percent ?? "",
    ),
    dueDate: normalizeDateOnly(assessment?.dueDate || assessment?.due_date || ""),
  };
}

function getSupabaseClient() {
  return window.supabaseClient || null;
}

function parseTemplateDescription(templateDescription) {
  if (!templateDescription) {
    return {
      summary: "",
      assessments: [],
      sourceCourseId: null,
      sourceCourseCode: "",
    };
  }

  try {
    const parsedValue = JSON.parse(templateDescription);
    return {
      summary: String(parsedValue.summary || "").trim(),
      assessments: Array.isArray(parsedValue.assessments)
        ? parsedValue.assessments.map(normalizeAssessment)
        : [],
      sourceCourseId: parsedValue.sourceCourseId || null,
      sourceCourseCode: String(parsedValue.sourceCourseCode || "").trim(),
    };
  } catch (error) {
    return {
      summary: String(templateDescription).trim(),
      assessments: [],
      sourceCourseId: null,
      sourceCourseCode: "",
    };
  }
}

function serializeTemplateDescription({
  summary = "",
  assessments = [],
  sourceCourseId = null,
  sourceCourseCode = "",
}) {
  return JSON.stringify({
    summary: String(summary).trim(),
    sourceCourseId,
    sourceCourseCode: String(sourceCourseCode).trim(),
    assessments: Array.isArray(assessments)
      ? assessments.map(normalizeAssessment)
      : [],
  });
}

function getAllCourseTemplates() {
  return readJsonStorage(COURSE_TEMPLATE_STORAGE_KEY, {});
}

function getCourseTemplate(courseId) {
  const templates = getAllCourseTemplates();
  const template = templates[courseId];

  if (!template) {
    return {
      courseId,
      assessments: [],
    };
  }

  return {
    courseId,
    assessments: Array.isArray(template.assessments)
      ? template.assessments.map(normalizeAssessment)
      : [],
  };
}

function saveCourseTemplate(courseId, assessments) {
  const templates = getAllCourseTemplates();
  templates[courseId] = {
    courseId,
    assessments: Array.isArray(assessments)
      ? assessments.map(normalizeAssessment)
      : [],
  };
  writeJsonStorage(COURSE_TEMPLATE_STORAGE_KEY, templates);
}

async function loadCourseTemplate(courseId) {
  const supabaseClient = getSupabaseClient();

  if (!supabaseClient || !courseId) {
    return getCourseTemplate(courseId);
  }

  try {
    const { data, error } = await supabaseClient
      .from("assessments")
      .select(
        "assessment_id, title, weight_percent, due_date, is_published",
      )
      .eq("course_offering_id", courseId)
      .eq("is_published", true)
      .order("due_date", { ascending: true });

    if (error) {
      throw error;
    }

    const normalizedAssessments = Array.isArray(data)
      ? data.map(normalizeAssessment)
      : [];

    saveCourseTemplate(courseId, normalizedAssessments);
    return {
      courseId,
      assessments: normalizedAssessments,
    };
  } catch (error) {
    console.error("Unable to load course template from database:", error);
    return getCourseTemplate(courseId);
  }
}

async function saveCourseTemplateToDatabase(courseId, assessments) {
  const supabaseClient = getSupabaseClient();

  if (!supabaseClient || !courseId) {
    return;
  }

  const normalizedAssessments = Array.isArray(assessments)
    ? assessments.map(normalizeAssessment)
    : [];

  const { error: deleteError } = await supabaseClient
    .from("assessments")
    .delete()
    .eq("course_offering_id", courseId);

  if (deleteError) {
    throw deleteError;
  }

  if (normalizedAssessments.length === 0) {
    return;
  }

  const rows = normalizedAssessments.map((assessment) => ({
    assessment_id: assessment.id,
    course_offering_id: courseId,
    title: assessment.name,
    weight_percent: parseWeightNumber(assessment.weight),
    due_date: assessment.dueDate,
    is_published: true,
  }));

  const { error: insertError } = await supabaseClient
    .from("assessments")
    .insert(rows);

  if (insertError) {
    throw insertError;
  }
}

async function saveCourseTemplateEverywhere(courseId, assessments) {
  saveCourseTemplate(courseId, assessments);
  await saveCourseTemplateToDatabase(courseId, assessments);
}

async function loadReusableTemplates(createdByUserId) {
  const supabaseClient = getSupabaseClient();
  if (!supabaseClient || !createdByUserId) {
    return [];
  }

  const { data, error } = await supabaseClient
    .from("course_templates")
    .select(
      "course_template_id, template_name, template_description, created_by_user_id, is_active, created_at",
    )
    .eq("created_by_user_id", createdByUserId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map((template) => {
    const descriptionData = parseTemplateDescription(
      template.template_description,
    );

    return {
      templateId: template.course_template_id,
      templateName: template.template_name,
      templateDescription: descriptionData.summary,
      assessments: descriptionData.assessments,
      sourceCourseId: descriptionData.sourceCourseId,
      sourceCourseCode: descriptionData.sourceCourseCode,
      createdByUserId: template.created_by_user_id,
      isActive: template.is_active,
      createdAt: template.created_at,
    };
  });
}

async function saveReusableTemplate({
  templateName,
  templateSummary = "",
  createdByUserId,
  assessments,
  sourceCourseId = null,
  sourceCourseCode = "",
}) {
  const supabaseClient = getSupabaseClient();
  if (!supabaseClient) {
    throw new Error("Supabase client is not loaded.");
  }

  const normalizedAssessments = Array.isArray(assessments)
    ? assessments.map(normalizeAssessment)
    : [];

  const serializedDescription = serializeTemplateDescription({
    summary: templateSummary,
    assessments: normalizedAssessments,
    sourceCourseId,
    sourceCourseCode,
  });

  const { data: existingTemplate, error: lookupError } = await supabaseClient
    .from("course_templates")
    .select("course_template_id")
    .eq("created_by_user_id", createdByUserId)
    .eq("template_name", templateName)
    .maybeSingle();

  if (lookupError) {
    throw lookupError;
  }

  if (existingTemplate?.course_template_id) {
    const { data, error } = await supabaseClient
      .from("course_templates")
      .update({
        template_description: serializedDescription,
        is_active: true,
      })
      .eq("course_template_id", existingTemplate.course_template_id)
      .select("course_template_id, template_name, template_description, created_by_user_id, is_active, created_at")
      .single();

    if (error) {
      throw error;
    }

    const descriptionData = parseTemplateDescription(data.template_description);
    return {
      templateId: data.course_template_id,
      templateName: data.template_name,
      templateDescription: descriptionData.summary,
      assessments: descriptionData.assessments,
      sourceCourseId: descriptionData.sourceCourseId,
      sourceCourseCode: descriptionData.sourceCourseCode,
      createdByUserId: data.created_by_user_id,
      isActive: data.is_active,
      createdAt: data.created_at,
    };
  }

  const { data, error } = await supabaseClient
    .from("course_templates")
    .insert({
      template_name: templateName,
      template_description: serializedDescription,
      created_by_user_id: createdByUserId,
      is_active: true,
    })
    .select("course_template_id, template_name, template_description, created_by_user_id, is_active, created_at")
    .single();

  if (error) {
    throw error;
  }

  const descriptionData = parseTemplateDescription(data.template_description);
  return {
    templateId: data.course_template_id,
    templateName: data.template_name,
    templateDescription: descriptionData.summary,
    assessments: descriptionData.assessments,
    sourceCourseId: descriptionData.sourceCourseId,
    sourceCourseCode: descriptionData.sourceCourseCode,
    createdByUserId: data.created_by_user_id,
    isActive: data.is_active,
    createdAt: data.created_at,
  };
}

async function applyReusableTemplateToCourse(courseId, template) {
  const assessments = Array.isArray(template?.assessments)
    ? template.assessments.map(normalizeAssessment)
    : [];

  saveCourseTemplate(courseId, assessments);
  await saveCourseTemplateToDatabase(courseId, assessments);
}

function getAllStudentEnrollments() {
  return readJsonStorage(STUDENT_ENROLLMENT_STORAGE_KEY, {});
}

function getStudentsEnrolledInCourse(courseId) {
  const allEnrollments = getAllStudentEnrollments();

  return Object.entries(allEnrollments)
    .filter(([, courses]) =>
      Array.isArray(courses) &&
      courses.some((course) => course.courseOfferingId === courseId),
    )
    .map(([userId]) => userId);
}

function getStudentEnrollments(userId) {
  const enrollments = getAllStudentEnrollments();
  return Array.isArray(enrollments[userId]) ? enrollments[userId] : [];
}

function saveStudentEnrollments(userId, courses) {
  const enrollments = getAllStudentEnrollments();
  enrollments[userId] = Array.isArray(courses) ? courses : [];
  writeJsonStorage(STUDENT_ENROLLMENT_STORAGE_KEY, enrollments);
}

function upsertStudentEnrollment(userId, course) {
  const courses = getStudentEnrollments(userId);
  const existingIndex = courses.findIndex(
    (existingCourse) => existingCourse.courseOfferingId === course.courseOfferingId,
  );

  if (existingIndex >= 0) {
    courses[existingIndex] = course;
  } else {
    courses.unshift(course);
  }

  saveStudentEnrollments(userId, courses);
}

function removeStudentEnrollment(userId, courseOfferingId) {
  const courses = getStudentEnrollments(userId).filter(
    (course) => course.courseOfferingId !== courseOfferingId,
  );
  saveStudentEnrollments(userId, courses);
}

function getAllStudentProgress() {
  return readJsonStorage(STUDENT_PROGRESS_STORAGE_KEY, {});
}

function getStudentCourseProgress(userId, courseId) {
  const allProgress = getAllStudentProgress();
  return allProgress[userId]?.[courseId] || {};
}

function saveStudentCourseProgress(userId, courseId, progressByAssessmentId) {
  const allProgress = getAllStudentProgress();
  const userProgress = allProgress[userId] || {};
  userProgress[courseId] = progressByAssessmentId;
  allProgress[userId] = userProgress;
  writeJsonStorage(STUDENT_PROGRESS_STORAGE_KEY, allProgress);
}

function updateStudentAssessmentProgress(userId, courseId, assessmentId, progress) {
  const courseProgress = getStudentCourseProgress(userId, courseId);
  courseProgress[assessmentId] = {
    grade: String(progress?.grade || "").trim(),
    status: String(progress?.status || "Not started").trim() || "Not started",
  };
  saveStudentCourseProgress(userId, courseId, courseProgress);
}

function removeStudentCourseProgress(userId, courseId) {
  const allProgress = getAllStudentProgress();
  if (!allProgress[userId]) {
    return;
  }

  delete allProgress[userId][courseId];
  writeJsonStorage(STUDENT_PROGRESS_STORAGE_KEY, allProgress);
}

function getAssessmentSubmissionSummary(courseId, assessmentId) {
  const enrolledStudentIds = getStudentsEnrolledInCourse(courseId);
  const allProgress = getAllStudentProgress();

  const submittedCount = enrolledStudentIds.reduce((count, userId) => {
    const assessmentProgress = allProgress[userId]?.[courseId]?.[assessmentId];
    return assessmentProgress?.status === "Submitted" ? count + 1 : count;
  }, 0);

  const totalCount = enrolledStudentIds.length;
  const completionRate =
    totalCount > 0 ? ((submittedCount / totalCount) * 100).toFixed(2) : "--";

  return {
    submittedCount,
    totalCount,
    completionStatusText: `${submittedCount}/${totalCount}`,
    completionRateText:
      totalCount > 0 ? `${completionRate}%` : "--",
  };
}

window.CourseDataStore = {
  createAssessmentId,
  getCourseTemplate,
  loadCourseTemplate,
  saveCourseTemplate,
  saveCourseTemplateEverywhere,
  loadReusableTemplates,
  saveReusableTemplate,
  applyReusableTemplateToCourse,
  getStudentEnrollments,
  upsertStudentEnrollment,
  removeStudentEnrollment,
  getStudentCourseProgress,
  updateStudentAssessmentProgress,
  saveStudentCourseProgress,
  removeStudentCourseProgress,
  getAssessmentSubmissionSummary,
};
