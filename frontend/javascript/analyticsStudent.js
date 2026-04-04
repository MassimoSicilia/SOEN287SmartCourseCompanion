const supabaseClient = window.supabaseClient;
const courseDataStore = window.CourseDataStore;
const apiClient = window.SmartCourseApi;
const barChartContainer = document.getElementById("barChartContainer");
const totalGradeContainer = document.getElementById("totalGradeContainer");
const gpaContainer = document.getElementById("gpaContainer");
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

function renderCurrentAverage(value) {
  if (!totalGradeContainer) {
    return;
  }

  if (!Number.isFinite(value)) {
    totalGradeContainer.setAttribute("aria-valuenow", "0");
    totalGradeContainer.style.setProperty("--value", "0");
    totalGradeContainer.innerHTML = "<p>N/A</p>";
    return;
  }

  const safeValue = clampPercent(value);
  const roundedValue = Number(safeValue.toFixed(1));
  totalGradeContainer.setAttribute("aria-valuenow", String(roundedValue));
  totalGradeContainer.style.setProperty("--value", String(roundedValue));
  totalGradeContainer.innerHTML = `<p>${formatPercent(safeValue, 1)}</p>`;
}

function renderGpa(value) {
  if (!gpaContainer) {
    return;
  }

  if (!Number.isFinite(value)) {
    gpaContainer.innerHTML = "<p>N/A</p>";
    return;
  }

  gpaContainer.innerHTML = `<p>${value.toFixed(1)}</p>`;
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

function calculateOverallAverage(courseGrades) {
  if (!Array.isArray(courseGrades) || courseGrades.length === 0) {
    return null;
  }

  const total = courseGrades.reduce((sum, course) => sum + course.grade, 0);
  return total / courseGrades.length;
}

function convertPercentToGradePoints(grade) {
  if (!Number.isFinite(grade)) {
    return null;
  }

  if (grade >= 90) {
    return 4.3;
  }

  if (grade >= 85) {
    return 4.0;
  }

  if (grade >= 80) {
    return 3.7;
  }

  if (grade >= 77) {
    return 3.3;
  }

  if (grade >= 73) {
    return 3.0;
  }

  if (grade >= 70) {
    return 2.7;
  }

  if (grade >= 67) {
    return 2.3;
  }

  if (grade >= 63) {
    return 2.0;
  }

  if (grade >= 60) {
    return 1.7;
  }

  if (grade >= 57) {
    return 1.3;
  }

  if (grade >= 53) {
    return 1.0;
  }

  if (grade >= 50) {
    return 0.7;
  }

  return 0;
}

function calculateGpa(courseGrades) {
  if (!Array.isArray(courseGrades) || courseGrades.length === 0) {
    return null;
  }

  let weightedGradePoints = 0;
  let totalCredits = 0;

  courseGrades.forEach((course) => {
    const credits = Number(course.credits);
    const gradePoints = convertPercentToGradePoints(course.grade);

    if (!Number.isFinite(credits) || credits <= 0 || gradePoints === null) {
      return;
    }

    weightedGradePoints += gradePoints * credits;
    totalCredits += credits;
  });

  if (totalCredits === 0) {
    return null;
  }

  return weightedGradePoints / totalCredits;
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
    credits: course.credits,
    grade: calculateCourseAverage(template.assessments, courseProgress),
  };
}

async function initializeAnalyticsPage() {
  if (!barChartContainer) {
    return;
  }

  if (!supabaseClient || !courseDataStore) {
    renderMessage("Analytics are unavailable right now.");
    renderCurrentAverage(null);
    renderGpa(null);
    return;
  }

  renderMessage("Loading grades...");
  renderCurrentAverage(null);
  renderGpa(null);

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
      renderCurrentAverage(null);
      renderGpa(null);
      return;
    }

    renderCourseGradeBars(courseGrades);
    renderCurrentAverage(calculateOverallAverage(courseGrades));
    renderGpa(calculateGpa(courseGrades));
  } catch (error) {
    console.error("Unable to load student analytics:", error);
    renderMessage(error.message || "Unable to load analytics right now.");
    renderCurrentAverage(null);
    renderGpa(null);
  }
}

initializeAnalyticsPage();
