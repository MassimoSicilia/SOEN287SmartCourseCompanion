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

async function saveCourseTemplateEverywhere(courseId, assessments) {
  const normalizedAssessments = Array.isArray(assessments)
    ? assessments.map(normalizeAssessment)
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

  return (response?.templates || []).map((template) => {
    const descriptionData = parseTemplateDescription(
      template.templateDescription,
    );

    return {
      templateId: template.templateId,
      templateName: template.templateName,
      templateDescription: descriptionData.summary,
      assessments: descriptionData.assessments,
      sourceCourseId: descriptionData.sourceCourseId,
      sourceCourseCode: descriptionData.sourceCourseCode,
      createdByUserId: template.createdByUserId,
      isActive: template.isActive,
      createdAt: template.createdAt,
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
  const apiClient = getApiClient();
  if (!apiClient) {
    throw new Error("Node API client is not loaded.");
  }

  const normalizedAssessments = Array.isArray(assessments)
    ? assessments.map(normalizeAssessment)
    : [];

  const response = await apiClient.saveReusableTemplate({
    templateName,
    templateDescription: serializeTemplateDescription({
      summary: templateSummary,
      assessments: normalizedAssessments,
      sourceCourseId,
      sourceCourseCode,
    }),
    createdByUserId,
  });

  const descriptionData = parseTemplateDescription(response.templateDescription);
  return {
    templateId: response.templateId,
    templateName: response.templateName,
    templateDescription: descriptionData.summary,
    assessments: descriptionData.assessments,
    sourceCourseId: descriptionData.sourceCourseId,
    sourceCourseCode: descriptionData.sourceCourseCode,
    createdByUserId: response.createdByUserId,
    isActive: response.isActive,
    createdAt: response.createdAt,
  };
}

async function applyReusableTemplateToCourse(courseId, template) {
  const assessments = Array.isArray(template?.assessments)
    ? template.assessments.map(normalizeAssessment)
    : [];

  await saveCourseTemplateEverywhere(courseId, assessments);
}

function getAllStudentEnrollments() {
  return readJsonStorage(STUDENT_ENROLLMENT_STORAGE_KEY, {});
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

async function loadStudentEnrollments(userId) {
  const apiClient = getApiClient();
  const cachedEnrollments = getStudentEnrollments(userId);
  if (!apiClient || !userId) {
    return cachedEnrollments;
  }

  if (cachedEnrollments.length > 0) {
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

async function loadStudentCourseProgress(userId, courseId) {
  const apiClient = getApiClient();
  const cachedProgress = getStudentCourseProgress(userId, courseId);
  if (!apiClient || !userId || !courseId) {
    return cachedProgress;
  }

  if (Object.keys(cachedProgress).length > 0) {
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

  if (Object.keys(cachedSummary).length > 0) {
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
  return (
    summaries[courseId]?.[assessmentId] || {
      submittedCount: 0,
      totalCount: 0,
      completionStatusText: "0/0",
      completionRateText: "--",
    }
  );
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
