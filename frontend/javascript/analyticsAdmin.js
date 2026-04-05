const supabaseClient = window.supabaseClient;
const barChartContainer = document.getElementById("barChartContainer");
const submissionRateContainer = document.getElementById("submissionRateContainer");
const STUDENT_ENROLLMENT_STORAGE_KEY = "smartStudentEnrollments";
const STUDENT_PROGRESS_STORAGE_KEY = "smartStudentAssessmentProgress";

function clampPercent(value) {
  return Math.max(0, Math.min(100, value));
}

function normalizeGrade(value) {
  const trimmedValue = String(value || "")
    .replace("%", "")
    .trim();

  if (!trimmedValue) {
    return null;
  }

  const numericValue = Number(trimmedValue);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return null;
  }

  return clampPercent(numericValue);
}

function parseWeight(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return null;
  }

  return numericValue;
}

function isSubmittedStatus(value) {
  return String(value || "").trim().toLowerCase() === "submitted";
}

function formatAverageLabel(value) {
  if (value === null) {
    return "N/A";
  }

  return `${Math.round(value)}%`;
}

function getCourseDisplayCode(course, duplicateCourseCodes) {
  if (duplicateCourseCodes.has(course.courseCode)) {
    return `${course.courseCode}-${course.section}`;
  }

  return course.courseCode;
}

function renderMessage(message) {
  if (!barChartContainer) {
    return;
  }

  barChartContainer.innerHTML = `<p class="analytics-empty-state">${message}</p>`;
}

function renderSubmissionRate(rate) {
  if (!submissionRateContainer) {
    return;
  }

  const safeRate = clampPercent(rate);
  const roundedRate = Math.round(safeRate);
  submissionRateContainer.setAttribute("aria-valuenow", String(roundedRate));
  submissionRateContainer.style.setProperty("--value", String(roundedRate));
  submissionRateContainer.innerHTML = `<p>${roundedRate}%</p>`;
}

function renderCourseAverageBars(courseAverages, enrollmentsByCourse) {
  if (!barChartContainer) {
    return;
  }

  if (courseAverages.length === 0) {
    renderMessage("No courses available for analytics.");
    return;
  }

  const duplicateCourseCodes = new Set(
    courseAverages
      .filter(
        (course, index, courses) =>
          courses.findIndex((candidate) => candidate.courseCode === course.courseCode) !== index,
      )
      .map((course) => course.courseCode),
  );

  const rowsMarkup = courseAverages
    .map((course) => {
      const safeAverage = course.average === null ? 0 : clampPercent(course.average);
      const valueLabel = formatAverageLabel(course.average);
      const courseLabel = getCourseDisplayCode(course, duplicateCourseCodes);
      const enrolledCount = (enrollmentsByCourse.get(course.courseOfferingId) || []).length;
      const studentLabel = enrolledCount === 1 ? "student" : "students";
      const ariaLabel =
        course.average === null
          ? `${course.courseCode} ${course.courseName} has no graded submissions yet`
          : `${course.courseCode} ${course.courseName} class average ${valueLabel}`;

      return `
        <div class="grade-bar-column">
          <span class="grade-value">${valueLabel}</span>
          <div class="bar-track-vertical" role="img" aria-label="${ariaLabel}">
            <div class="bar-fill-vertical" style="height: ${safeAverage}%;"></div>
          </div>
          <span class="course-name" title="${course.courseCode} - ${course.courseName} (${course.section})">${courseLabel}</span>
          <span class="course-student-count">${enrolledCount} ${studentLabel}</span>
        </div>
      `;
    })
    .join("");

  barChartContainer.innerHTML = rowsMarkup;
}

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

function mergeLocalEnrollmentsByCourse(courseIds, enrollmentsByCourse) {
  const allEnrollments = readJsonStorage(STUDENT_ENROLLMENT_STORAGE_KEY, {});
  const allowedCourseIds = new Set(courseIds);

  Object.entries(allEnrollments).forEach(([userId, courses]) => {
    if (!Array.isArray(courses)) {
      return;
    }

    courses.forEach((course) => {
      const courseId = course?.courseOfferingId;
      if (!allowedCourseIds.has(courseId)) {
        return;
      }

      const existingUserIds = enrollmentsByCourse.get(courseId) || [];
      if (!existingUserIds.includes(userId)) {
        enrollmentsByCourse.set(courseId, [...existingUserIds, userId]);
      }
    });
  });

  return enrollmentsByCourse;
}

function mergeLocalProgressByCourse(courseIds, progressByCourse) {
  const allProgress = readJsonStorage(STUDENT_PROGRESS_STORAGE_KEY, {});
  const allowedCourseIds = new Set(courseIds);

  Object.entries(allProgress).forEach(([userId, progressByCourseId]) => {
    if (!progressByCourseId || typeof progressByCourseId !== "object") {
      return;
    }

    Object.entries(progressByCourseId).forEach(([courseId, progressByAssessmentId]) => {
      if (!allowedCourseIds.has(courseId) || !progressByAssessmentId) {
        return;
      }

      const progressKey = `${courseId}:${userId}`;
      const existingProgress = progressByCourse.get(progressKey) || {};
      progressByCourse.set(progressKey, {
        ...existingProgress,
        ...progressByAssessmentId,
      });
    });
  });

  return progressByCourse;
}

async function getCurrentAdminUserId() {
  if (!supabaseClient) {
    throw new Error("Supabase client is not loaded.");
  }

  const {
    data: { user },
    error,
  } = await supabaseClient.auth.getUser();

  if (error) {
    throw error;
  }

  if (!user) {
    throw new Error("You must be logged in to view analytics.");
  }

  return user.id;
}

async function loadAdminCourses(adminUserId) {
  const { data, error } = await supabaseClient
    .from("available_courses")
    .select("course_offering_id, course_code, course_name, section")
    .eq("created_by_user_id", adminUserId)
    .eq("is_enabled", true)
    .order("course_code", { ascending: true })
    .order("section", { ascending: true });

  if (error) {
    throw error;
  }

  return (data || []).map((course) => ({
    courseOfferingId: course.course_offering_id,
    courseCode: course.course_code,
    courseName: course.course_name,
    section: course.section,
  }));
}

async function loadAssessmentsByCourse(courseIds) {
  if (courseIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabaseClient
    .from("assessments")
    .select("assessment_id, course_offering_id, weight_percent")
    .in("course_offering_id", courseIds);

  if (error) {
    throw error;
  }

  return (data || []).reduce((map, assessment) => {
    const courseId = assessment.course_offering_id;
    const courseAssessments = map.get(courseId) || [];
    courseAssessments.push({
      assessmentId: assessment.assessment_id,
      weightPercent: assessment.weight_percent,
    });
    map.set(courseId, courseAssessments);
    return map;
  }, new Map());
}

async function loadEnrollmentsByCourse(courseIds) {
  if (courseIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabaseClient
    .from("student_course_enrollments")
    .select("user_id, course_offering_id")
    .in("course_offering_id", courseIds);

  if (error) {
    throw error;
  }

  const enrollmentsByCourse = (data || []).reduce((map, enrollment) => {
    const courseId = enrollment.course_offering_id;
    const courseEnrollments = map.get(courseId) || [];
    courseEnrollments.push(enrollment.user_id);
    map.set(courseId, courseEnrollments);
    return map;
  }, new Map());

  return mergeLocalEnrollmentsByCourse(courseIds, enrollmentsByCourse);
}

async function loadProgressByCourse(courseIds) {
  if (courseIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabaseClient
    .from("student_assessment_progress")
    .select("user_id, course_offering_id, assessment_id, grade, status")
    .in("course_offering_id", courseIds);

  if (error) {
    throw error;
  }

  const progressByCourse = (data || []).reduce((map, progressRow) => {
    const progressKey = `${progressRow.course_offering_id}:${progressRow.user_id}`;
    const progressByAssessmentId = map.get(progressKey) || {};
    progressByAssessmentId[progressRow.assessment_id] = {
      grade: progressRow.grade,
      status: progressRow.status,
    };
    map.set(progressKey, progressByAssessmentId);
    return map;
  }, new Map());

  return mergeLocalProgressByCourse(courseIds, progressByCourse);
}

function calculateStudentCourseAverage(assessments, progressByAssessmentId) {
  let weightedSum = 0;
  let totalWeight = 0;

  assessments.forEach((assessment) => {
    const weight = parseWeight(assessment.weightPercent);
    const grade = normalizeGrade(progressByAssessmentId?.[assessment.assessmentId]?.grade);

    if (weight === null || grade === null) {
      return;
    }

    weightedSum += grade * weight;
    totalWeight += weight;
  });

  if (totalWeight === 0) {
    return null;
  }

  return weightedSum / totalWeight;
}

function calculateCourseAverages(courses, assessmentsByCourse, enrollmentsByCourse, progressByCourse) {
  return courses.map((course) => {
    const assessments = assessmentsByCourse.get(course.courseOfferingId) || [];
    const enrolledUserIds = enrollmentsByCourse.get(course.courseOfferingId) || [];

    const studentAverages = enrolledUserIds
      .map((userId) =>
        calculateStudentCourseAverage(
          assessments,
          progressByCourse.get(`${course.courseOfferingId}:${userId}`) || {},
        ),
      )
      .filter((average) => average !== null);

    const average =
      studentAverages.length > 0
        ? studentAverages.reduce((sum, value) => sum + value, 0) / studentAverages.length
        : null;

    return {
      ...course,
      average,
    };
  });
}

function calculateSubmissionRate(courses, assessmentsByCourse, enrollmentsByCourse, progressByCourse) {
  let submittedCount = 0;
  let totalExpectedSubmissions = 0;

  courses.forEach((course) => {
    const assessments = assessmentsByCourse.get(course.courseOfferingId) || [];
    const enrolledUserIds = enrollmentsByCourse.get(course.courseOfferingId) || [];

    enrolledUserIds.forEach((userId) => {
      const progressByAssessmentId =
        progressByCourse.get(`${course.courseOfferingId}:${userId}`) || {};

      assessments.forEach((assessment) => {
        totalExpectedSubmissions += 1;

        if (isSubmittedStatus(progressByAssessmentId[assessment.assessmentId]?.status)) {
          submittedCount += 1;
        }
      });
    });
  });

  if (totalExpectedSubmissions === 0) {
    return 0;
  }

  return (submittedCount / totalExpectedSubmissions) * 100;
}

async function initializeAnalyticsPage() {
  if (!barChartContainer) {
    return;
  }

  renderMessage("Loading course analytics...");

  try {
    const adminUserId = await getCurrentAdminUserId();
    const courses = await loadAdminCourses(adminUserId);

    if (courses.length === 0) {
      renderMessage("No courses available for analytics.");
      renderSubmissionRate(0);
      return;
    }

    const courseIds = courses.map((course) => course.courseOfferingId);
    const [assessmentsByCourse, enrollmentsByCourse, progressByCourse] =
      await Promise.all([
        loadAssessmentsByCourse(courseIds),
        loadEnrollmentsByCourse(courseIds),
        loadProgressByCourse(courseIds),
      ]);

    renderSubmissionRate(
      calculateSubmissionRate(
        courses,
        assessmentsByCourse,
        enrollmentsByCourse,
        progressByCourse,
      ),
    );
    renderCourseAverageBars(
      calculateCourseAverages(
        courses,
        assessmentsByCourse,
        enrollmentsByCourse,
        progressByCourse,
      ),
      enrollmentsByCourse,
    );
  } catch (error) {
    console.error("Unable to load admin analytics:", error);
    renderSubmissionRate(0);
    renderMessage(error.message || "Unable to load analytics right now.");
  }
}

initializeAnalyticsPage();
