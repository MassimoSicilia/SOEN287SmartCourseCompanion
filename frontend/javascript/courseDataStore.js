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
  return `assessment-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function normalizeAssessment(assessment) {
  return {
    id: assessment?.id || createAssessmentId(),
    name: String(assessment?.name || "").trim(),
    weight: String(assessment?.weight || "").trim(),
    dueDate: String(assessment?.dueDate || "").trim(),
  };
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

function getAllStudentEnrollments() {
  return readJsonStorage(STUDENT_ENROLLMENT_STORAGE_KEY, {});
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

window.CourseDataStore = {
  createAssessmentId,
  getCourseTemplate,
  saveCourseTemplate,
  getStudentEnrollments,
  upsertStudentEnrollment,
  removeStudentEnrollment,
  getStudentCourseProgress,
  updateStudentAssessmentProgress,
  saveStudentCourseProgress,
  removeStudentCourseProgress,
};
