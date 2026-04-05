const COURSE_TEMPLATE_STORAGE_KEY = "smartCourseTemplates";
const STUDENT_ENROLLMENT_STORAGE_KEY = "smartStudentEnrollments";
const STUDENT_PROGRESS_STORAGE_KEY = "smartStudentAssessmentProgress";
const COURSE_SUBMISSION_SUMMARY_STORAGE_KEY = "smartCourseSubmissionSummary";

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

function normalizeAssessment(assessment) {
  return {
    id: assessment?.id || assessment?.assessment_id || createAssessmentId(),
    courseCode: String(assessment?.courseCode || assessment?.course_code || "").trim(),
    name: String(
      assessment?.name || assessment?.assessment_name || assessment?.title || "",
    ).trim(),
    weight: normalizeWeightValue(
      assessment?.weight ?? assessment?.weight_percent ?? "",
    ),
    dueDate: normalizeDateOnly(assessment?.dueDate || assessment?.due_date || ""),
  };
}

function getApiClient() {
  return window.SmartCourseApi || null;
}

function normalizeReusableTemplate(template) {
  const descriptionData = parseTemplateDescription(template?.templateDescription);

  return {
    templateId: String(
      template?.templateId || template?.course_template_id || createAssessmentId(),
    ).trim(),
    templateName: String(template?.templateName || template?.template_name || "").trim(),
    templateDescription: descriptionData.summary,
    assessments: descriptionData.assessments,
    sourceCourseId: descriptionData.sourceCourseId,
    sourceCourseCode: descriptionData.sourceCourseCode,
    createdByUserId: String(
      template?.createdByUserId || template?.created_by_user_id || "",
    ).trim(),
    isActive: template?.isActive !== false,
    createdAt: template?.createdAt || template?.created_at || new Date().toISOString(),
  };
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
  const apiClient = getApiClient();
  const cachedTemplate = getCourseTemplate(courseId);

  if (!apiClient || !courseId) {
    return cachedTemplate;
  }

  if (cachedTemplate.assessments.length > 0) {
    return cachedTemplate;
  }

  try {
    const response = await apiClient.getCourseTemplate(courseId);
    const normalizedAssessments = Array.isArray(response?.assessments)
      ? response.assessments.map(normalizeAssessment)
      : [];

    saveCourseTemplate(courseId, normalizedAssessments);
    return {
      courseId,
      assessments: normalizedAssessments,
    };
  } catch (error) {
    console.error("Unable to load course template from Node API:", error);
    return getCourseTemplate(courseId);
  }
}

async function saveCourseTemplateEverywhere(courseId, assessments, courseCode = "") {
  const normalizedAssessments = Array.isArray(assessments)
    ? assessments.map((assessment) => ({
        ...normalizeAssessment(assessment),
        courseCode: String(
          courseCode || assessment?.courseCode || assessment?.course_code || "",
        ).trim(),
      }))
    : [];

  saveCourseTemplate(courseId, normalizedAssessments);

  const apiClient = getApiClient();
  if (!apiClient || !courseId) {
    return;
  }

  await apiClient.saveCourseTemplate(courseId, normalizedAssessments);
}

async function loadReusableTemplates(createdByUserId) {
  const apiClient = getApiClient();
  if (!apiClient || !createdByUserId) {
    return [];
  }

  const response = await apiClient.getReusableTemplates(createdByUserId);
  return (response?.templates || []).map(normalizeReusableTemplate);
}

async function saveReusableTemplate({
  templateName,
  templateSummary = "",
  createdByUserId,
  assessments,
  sourceCourseId = null,
  sourceCourseCode = "",
}) {
  const apiClient = getApiClient();
  if (!apiClient) {
    throw new Error("The template service is unavailable right now.");
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

  const response = await apiClient.saveReusableTemplate({
    templateName,
    templateDescription: serializedDescription,
    createdByUserId,
  });

  return normalizeReusableTemplate(response);
}

function buildReusableTemplateNameFromCourse(course, assessments) {
  const assessmentNames = Array.isArray(assessments)
    ? assessments
        .map((assessment) => String(assessment?.name || "").trim())
        .filter(Boolean)
    : [];

  if (assessmentNames.length === 0) {
    return `${course.courseCode} Template`;
  }

  return `${course.courseCode}: ${assessmentNames.join(" + ")}`;
}

function buildReusableTemplateSummaryFromCourse(course, assessments) {
  const summaryParts = Array.isArray(assessments)
    ? assessments.map((assessment) => {
        const name = String(assessment?.name || "").trim() || "Assessment";
        const weight = normalizeWeightValue(assessment?.weight || "");
        return `${name} ${weight || "0%"}`;
      })
    : [];

  if (summaryParts.length === 0) {
    return `Reusable assessment structure for ${course.courseCode}`;
  }

  return `${course.courseCode} template: ${summaryParts.join(", ")}`;
}

async function syncReusableTemplatesFromCourses(createdByUserId) {
  const apiClient = getApiClient();
  if (!apiClient || !createdByUserId) {
    return [];
  }

  let courses = [];

  try {
    const response = await apiClient.getCourses({
      enabled: false,
      createdByUserId,
    });
    courses = Array.isArray(response?.courses) ? response.courses : [];
  } catch (error) {
    console.error("Unable to load admin courses for reusable template sync:", error);
    return [];
  }

  const syncedTemplates = [];

  for (const course of courses) {
    const courseId = course?.courseOfferingId;
    if (!courseId) {
      continue;
    }

    try {
      const template = await loadCourseTemplate(courseId);
      const assessments = Array.isArray(template?.assessments)
        ? template.assessments.map(normalizeAssessment)
        : [];

      if (assessments.length === 0) {
        continue;
      }

      const savedTemplate = await saveReusableTemplate({
        templateName: buildReusableTemplateNameFromCourse(course, assessments),
        templateSummary: buildReusableTemplateSummaryFromCourse(course, assessments),
        createdByUserId,
        assessments,
        sourceCourseId: courseId,
        sourceCourseCode: String(course.courseCode || "").trim(),
      });

      syncedTemplates.push(savedTemplate);
    } catch (error) {
      console.error(`Unable to sync reusable template for course ${courseId}:`, error);
    }
  }

  return syncedTemplates;
}

async function applyReusableTemplateToCourse(courseId, template, courseCode = "") {
  const assessments = Array.isArray(template?.assessments)
    ? template.assessments.map((assessment) => ({
        ...normalizeAssessment(assessment),
        id: createAssessmentId(),
        courseCode: String(
          courseCode || assessment?.courseCode || assessment?.course_code || "",
        ).trim(),
      }))
    : [];

  await saveCourseTemplateEverywhere(courseId, assessments, courseCode);
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

function saveStudentEnrollmentsToCache(userId, courses) {
  const enrollments = getAllStudentEnrollments();
  enrollments[userId] = Array.isArray(courses) ? courses : [];
  writeJsonStorage(STUDENT_ENROLLMENT_STORAGE_KEY, enrollments);
}

async function syncCachedStudentEnrollmentsToApi(userId, courses) {
  const apiClient = getApiClient();
  if (!apiClient || !userId || !Array.isArray(courses) || courses.length === 0) {
    return;
  }

  await Promise.all(
    courses
      .filter((course) => course?.courseOfferingId)
      .map((course) => apiClient.addStudentEnrollment(userId, course.courseOfferingId)),
  );
}

async function loadStudentEnrollments(userId) {
  const apiClient = getApiClient();
  const cachedEnrollments = getStudentEnrollments(userId);
  if (!apiClient || !userId) {
    return cachedEnrollments;
  }

  if (cachedEnrollments.length > 0) {
    void syncCachedStudentEnrollmentsToApi(userId, cachedEnrollments);
    return cachedEnrollments;
  }

  try {
    const response = await apiClient.getStudentEnrollments(userId);
    const courses = Array.isArray(response?.courses) ? response.courses : [];
    saveStudentEnrollmentsToCache(userId, courses);
    return courses;
  } catch (error) {
    console.error("Unable to load student enrollments from Node API:", error);
    return getStudentEnrollments(userId);
  }
}

async function saveStudentEnrollments(userId, courses) {
  const previousCourses = getStudentEnrollments(userId);
  saveStudentEnrollmentsToCache(userId, courses);

  const apiClient = getApiClient();
  if (!apiClient || !userId) {
    return;
  }

  const existingIds = new Set(previousCourses.map((course) => course.courseOfferingId));
  const nextIds = new Set((courses || []).map((course) => course.courseOfferingId));

  await Promise.all(
    (courses || [])
      .filter((course) => !existingIds.has(course.courseOfferingId))
      .map((course) => apiClient.addStudentEnrollment(userId, course.courseOfferingId)),
  );

  await Promise.all(
    previousCourses
      .filter((course) => !nextIds.has(course.courseOfferingId))
      .map((course) => apiClient.removeStudentEnrollment(userId, course.courseOfferingId)),
  );
}

async function upsertStudentEnrollment(userId, course) {
  const courses = getStudentEnrollments(userId);
  const existingIndex = courses.findIndex(
    (existingCourse) => existingCourse.courseOfferingId === course.courseOfferingId,
  );

  if (existingIndex >= 0) {
    courses[existingIndex] = course;
  } else {
    courses.unshift(course);
  }

  saveStudentEnrollmentsToCache(userId, courses);

  const apiClient = getApiClient();
  if (!apiClient || !userId || !course?.courseOfferingId) {
    return;
  }

  await apiClient.addStudentEnrollment(userId, course.courseOfferingId);
}

async function removeStudentEnrollment(userId, courseOfferingId) {
  const courses = getStudentEnrollments(userId).filter(
    (course) => course.courseOfferingId !== courseOfferingId,
  );
  saveStudentEnrollmentsToCache(userId, courses);

  const apiClient = getApiClient();
  if (!apiClient || !userId || !courseOfferingId) {
    return;
  }

  await apiClient.removeStudentEnrollment(userId, courseOfferingId);
}

function getAllStudentProgress() {
  return readJsonStorage(STUDENT_PROGRESS_STORAGE_KEY, {});
}

function getStudentCourseProgress(userId, courseId) {
  const allProgress = getAllStudentProgress();
  return allProgress[userId]?.[courseId] || {};
}

function saveStudentCourseProgressToCache(userId, courseId, progressByAssessmentId) {
  const allProgress = getAllStudentProgress();
  const userProgress = allProgress[userId] || {};
  userProgress[courseId] = progressByAssessmentId;
  allProgress[userId] = userProgress;
  writeJsonStorage(STUDENT_PROGRESS_STORAGE_KEY, allProgress);
}

async function syncCachedStudentCourseProgressToApi(
  userId,
  courseId,
  progressByAssessmentId,
) {
  const apiClient = getApiClient();
  if (!apiClient || !userId || !courseId || !progressByAssessmentId) {
    return;
  }

  await apiClient.saveStudentCourseProgress(userId, courseId, progressByAssessmentId);
}

async function loadStudentCourseProgress(userId, courseId) {
  const apiClient = getApiClient();
  const cachedProgress = getStudentCourseProgress(userId, courseId);
  if (!apiClient || !userId || !courseId) {
    return cachedProgress;
  }

  if (Object.keys(cachedProgress).length > 0) {
    void syncCachedStudentCourseProgressToApi(userId, courseId, cachedProgress);
    return cachedProgress;
  }

  try {
    const response = await apiClient.getStudentCourseProgress(userId, courseId);
    const progressByAssessmentId = response?.progressByAssessmentId || {};
    saveStudentCourseProgressToCache(userId, courseId, progressByAssessmentId);
    return progressByAssessmentId;
  } catch (error) {
    console.error("Unable to load student progress from Node API:", error);
    return getStudentCourseProgress(userId, courseId);
  }
}

async function saveStudentCourseProgress(userId, courseId, progressByAssessmentId) {
  saveStudentCourseProgressToCache(userId, courseId, progressByAssessmentId);

  const apiClient = getApiClient();
  if (!apiClient || !userId || !courseId) {
    return;
  }

  await apiClient.saveStudentCourseProgress(
    userId,
    courseId,
    progressByAssessmentId,
  );
}

function updateStudentAssessmentProgress(userId, courseId, assessmentId, progress) {
  const courseProgress = getStudentCourseProgress(userId, courseId);
  courseProgress[assessmentId] = {
    grade: String(progress?.grade || "").trim(),
    status: String(progress?.status || "Not started").trim() || "Not started",
  };
  return saveStudentCourseProgress(userId, courseId, courseProgress);
}

async function removeStudentCourseProgress(userId, courseId) {
  const allProgress = getAllStudentProgress();
  if (allProgress[userId]) {
    delete allProgress[userId][courseId];
    writeJsonStorage(STUDENT_PROGRESS_STORAGE_KEY, allProgress);
  }

  const apiClient = getApiClient();
  if (!apiClient || !userId || !courseId) {
    return;
  }

  await apiClient.removeStudentCourseProgress(userId, courseId);
}

function getAllCourseSubmissionSummaries() {
  return readJsonStorage(COURSE_SUBMISSION_SUMMARY_STORAGE_KEY, {});
}

function saveCourseSubmissionSummaryToCache(courseId, summaryByAssessmentId) {
  const summaries = getAllCourseSubmissionSummaries();
  summaries[courseId] = summaryByAssessmentId || {};
  writeJsonStorage(COURSE_SUBMISSION_SUMMARY_STORAGE_KEY, summaries);
}

async function loadCourseSubmissionSummaries(courseId) {
  const apiClient = getApiClient();
  const cachedSummary = getAllCourseSubmissionSummaries()[courseId] || {};

  if (!apiClient || !courseId) {
    return cachedSummary;
  }

  try {
    const response = await apiClient.getCourseSubmissionSummary(courseId);
    const summaryByAssessmentId = response?.summaryByAssessmentId || {};
    saveCourseSubmissionSummaryToCache(courseId, summaryByAssessmentId);
    return summaryByAssessmentId;
  } catch (error) {
    console.error("Unable to load course submission summary from Node API:", error);
    return cachedSummary;
  }
}

function getAssessmentSubmissionSummary(courseId, assessmentId) {
  const summaries = getAllCourseSubmissionSummaries();
  const cachedSummary = summaries[courseId]?.[assessmentId];
  const enrolledStudentIds = getStudentsEnrolledInCourse(courseId);
  const allProgress = getAllStudentProgress();

  const submittedCount = enrolledStudentIds.reduce((count, userId) => {
    const assessmentProgress = allProgress[userId]?.[courseId]?.[assessmentId];
    return assessmentProgress?.status === "Submitted" ? count + 1 : count;
  }, 0);

  const totalCount = enrolledStudentIds.length;
  const completionRate =
    totalCount > 0 ? ((submittedCount / totalCount) * 100).toFixed(2) : "--";

  const localSummary = {
    submittedCount,
    totalCount,
    completionStatusText: `${submittedCount}/${totalCount}`,
    completionRateText: totalCount > 0 ? `${completionRate}%` : "--",
  };

  if (!cachedSummary) {
    return localSummary;
  }

  const cachedSubmittedCount = Number(cachedSummary.submittedCount ?? 0);
  const cachedTotalCount = Number(cachedSummary.totalCount ?? 0);

  if (
    submittedCount > cachedSubmittedCount ||
    totalCount !== cachedTotalCount
  ) {
    return localSummary;
  }

  return cachedSummary;
}

window.CourseDataStore = {
  createAssessmentId,
  getCourseTemplate,
  loadCourseTemplate,
  saveCourseTemplate,
  saveCourseTemplateEverywhere,
  loadReusableTemplates,
  saveReusableTemplate,
  syncReusableTemplatesFromCourses,
  applyReusableTemplateToCourse,
  getStudentEnrollments,
  loadStudentEnrollments,
  saveStudentEnrollments,
  upsertStudentEnrollment,
  removeStudentEnrollment,
  getStudentCourseProgress,
  loadStudentCourseProgress,
  updateStudentAssessmentProgress,
  saveStudentCourseProgress,
  removeStudentCourseProgress,
  loadCourseSubmissionSummaries,
  getAssessmentSubmissionSummary,
  prefetchCourseData(userId, courseId) {
    return Promise.all([
      loadCourseTemplate(courseId),
      loadStudentCourseProgress(userId, courseId),
      loadCourseSubmissionSummaries(courseId),
    ]);
  },
};
