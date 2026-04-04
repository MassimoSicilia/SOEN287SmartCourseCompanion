const supabaseClient = window.supabaseClient;
const courseDataStore = window.CourseDataStore;
const apiClient = window.SmartCourseApi;
const barChartContainer = document.getElementById("barChartContainer");
const ANALYTICS_STUDENT_USER_CACHE_KEY = "smartCurrentStudentUser";
const ENABLED_STUDENT_COURSES_CACHE_KEY = "smartEnabledStudentCourses";

function clampPercent(value) {
  return Math.max(0, Math.min(100, value));
}

function parsePercent(value) {
  const numericValue = Number.parseFloat(String(value ?? "").replace("%", "").trim());
  return Number.isFinite(numericValue) ? numericValue : null;
}

function formatPercent(value, digits = 0) {
  if (!Number.isFinite(value)) {
    return "N/A";
  }

  return `${value.toFixed(digits)}%`;
}

function normalizeGrade(value) {
  const parsed = parsePercent(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function renderMessage(message) {
  if (!barChartContainer) {
    return;
  }

  barChartContainer.innerHTML = `<p class="analytics-empty-state">${message}</p>`;
}

function getDuplicateCourseCodes(courses) {
  return new Set(
    courses
      .filter(
        (course, index, allCourses) =>
          allCourses.findIndex((candidate) => candidate.courseCode === course.courseCode) !== index,
      )
      .map((course) => course.courseCode),
  );
}

function getCourseDisplayCode(course, duplicateCourseCodes) {
  if (duplicateCourseCodes.has(course.courseCode)) {
    return `${course.courseCode}-${course.section}`;
  }

  return course.courseCode;
}

function renderCourseGradeBars(courseGrades) {
  if (!barChartContainer) {
    return;
  }

  if (courseGrades.length === 0) {
    renderMessage("No enrolled courses to show.");
    return;
  }

  const duplicateCourseCodes = getDuplicateCourseCodes(courseGrades);
  const rowsMarkup = courseGrades
    .map((course) => {
      const safeGrade = clampPercent(course.grade);
      const label = getCourseDisplayCode(course, duplicateCourseCodes);

      return `
        <div class="grade-bar-column">
          <span class="grade-value">${formatPercent(safeGrade)}</span>
          <div class="bar-track-vertical" role="img" aria-label="${course.courseCode} ${course.courseName} current grade ${formatPercent(safeGrade, 2)}">
            <div class="bar-fill-vertical" style="height: ${safeGrade}%;"></div>
          </div>
          <span class="course-name" title="${course.courseCode} - ${course.courseName} (${course.section})">${label}</span>
        </div>
      `;
    })
    .join("");

  barChartContainer.innerHTML = rowsMarkup;
}

async function getCurrentUser() {
  const cachedUser = sessionStorage.getItem(ANALYTICS_STUDENT_USER_CACHE_KEY);
  if (cachedUser) {
    try {
      return JSON.parse(cachedUser);
    } catch (error) {
      sessionStorage.removeItem(ANALYTICS_STUDENT_USER_CACHE_KEY);
    }
  }

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
    window.location.href = "login.html";
    return null;
  }

  sessionStorage.setItem(ANALYTICS_STUDENT_USER_CACHE_KEY, JSON.stringify(user));
  return user;
}

async function loadEnabledCourses() {
  const cachedCourses = sessionStorage.getItem(ENABLED_STUDENT_COURSES_CACHE_KEY);
  if (cachedCourses) {
    try {
      return JSON.parse(cachedCourses);
    } catch (error) {
      sessionStorage.removeItem(ENABLED_STUDENT_COURSES_CACHE_KEY);
    }
  }

  if (apiClient) {
    try {
      const response = await apiClient.getCourses({ enabled: true });
      const courses = Array.isArray(response?.courses) ? response.courses : [];
      sessionStorage.setItem(ENABLED_STUDENT_COURSES_CACHE_KEY, JSON.stringify(courses));
      return courses;
    } catch (error) {
      console.warn("Node API analytics course load failed, falling back to empty cache:", error);
    }
  }

  return [];
}

async function getRenderableCourses(currentUser) {
  const [enabledCourses, enrolledCourses] = await Promise.all([
    loadEnabledCourses(),
    courseDataStore.loadStudentEnrollments(currentUser.id),
  ]);

  const enabledCourseMap = new Map(
    enabledCourses.map((course) => [course.courseOfferingId, course]),
  );

  return enrolledCourses
    .map((course) => enabledCourseMap.get(course.courseOfferingId) || null)
    .filter(Boolean);
}

function calculateCourseAverage(assessments, courseProgress) {
  let weightedSum = 0;
  let totalWeight = 0;

  assessments.forEach((assessment) => {
    const grade = normalizeGrade(courseProgress[assessment.id]?.grade);
    const weight = parsePercent(assessment.weight);

    if (grade === null || weight === null) {
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

async function loadCourseGrade(course, userId) {
  const [template, courseProgress] = await Promise.all([
    courseDataStore.loadCourseTemplate(course.courseOfferingId),
    courseDataStore.loadStudentCourseProgress(userId, course.courseOfferingId),
  ]);

  return {
    courseCode: course.courseCode,
    courseName: course.courseName,
    section: course.section,
    grade: calculateCourseAverage(template.assessments, courseProgress),
  };
}

async function initializeAnalyticsPage() {
  if (!barChartContainer) {
    return;
  }

  if (!supabaseClient || !courseDataStore) {
    renderMessage("Analytics are unavailable right now.");
    return;
  }

  renderMessage("Loading grades...");

  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return;
    }

    const courses = await getRenderableCourses(currentUser);
    if (courses.length === 0) {
      renderMessage("No enrolled courses to show.");
      return;
    }

    const courseGrades = (await Promise.all(
      courses.map((course) => loadCourseGrade(course, currentUser.id)),
    )).filter((course) => course.grade !== null);

    if (courseGrades.length === 0) {
      renderMessage("No graded assessments to show yet.");
      return;
    }

    renderCourseGradeBars(courseGrades);
  } catch (error) {
    console.error("Unable to load student analytics:", error);
    renderMessage(error.message || "Unable to load analytics right now.");
  }
}

initializeAnalyticsPage();
