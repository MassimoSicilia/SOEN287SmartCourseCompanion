const supabaseClient = window.supabaseClient;
const courseDataStore = window.CourseDataStore;
const apiClient = window.SmartCourseApi;
const courseGradesContainer = document.querySelector(".course-grades");
const pageTitle = document.querySelector(".container h1");
const exportGradesPdfButton = document.getElementById("exportGradesPdfButton");
const GRADES_STUDENT_USER_CACHE_KEY = "smartCurrentStudentUser";
const ENABLED_STUDENT_COURSES_CACHE_KEY = "smartEnabledStudentCourses";
const gradesPageState = {
  currentUser: null,
  courses: [],
};

const CATEGORY_CONFIG = [
  { key: "assignments", label: "Assignments" },
  { key: "quizzes", label: "Quizzes" },
  { key: "midterm", label: "Midterm" },
  { key: "lab", label: "Lab" },
  { key: "project", label: "Project" },
  { key: "final", label: "Final" },
];

const CATEGORY_ALIASES = {
  assignment: "assignments",
  assignments: "assignments",
  quiz: "quizzes",
  quizzes: "quizzes",
  midterm: "midterm",
  midterms: "midterm",
  lab: "lab",
  labs: "lab",
  project: "project",
  projects: "project",
  final: "final",
  finals: "final",
};

function setPageTitle(courseCount) {
  if (!pageTitle) {
    return;
  }

  pageTitle.textContent =
    courseCount > 0 ? "Grades - All courses" : "Grades - No courses available";
}

function parsePercent(value) {
  const numericValue = Number.parseFloat(String(value ?? "").replace("%", "").trim());
  return Number.isFinite(numericValue) ? numericValue : null;
}

function formatPercent(value, digits = 0) {
  if (!Number.isFinite(value)) {
    return "-";
  }

  return `${value.toFixed(digits)}%`;
}

function normalizeGrade(value) {
  const parsed = parsePercent(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDueDateValue(value) {
  const timestamp = Date.parse(String(value || "").trim());
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
}

function getCategoryKeyFromAssessmentName(name) {
  const firstWord = String(name || "")
    .trim()
    .split(/\s+/)[0]
    ?.toLowerCase()
    .replace(/[^a-z]/g, "");

  return CATEGORY_ALIASES[firstWord] || null;
}

function createCourseBoxHeader(courseCode) {
  const header = document.createElement("div");
  header.className = "course-box-header";

  const title = document.createElement("h2");
  title.textContent = courseCode;

  const columns = document.createElement("div");
  columns.className = "course-box-columns";

  ["Assessments", "Grades", "Weights"].forEach((label) => {
    const span = document.createElement("span");
    span.textContent = label;
    columns.appendChild(span);
  });

  header.append(title, columns);
  return header;
}

function createCategoryRow(label, gradeText, weightText) {
  const row = document.createElement("li");

  const assessment = document.createElement("span");
  assessment.className = "col-assessment-name";
  assessment.textContent = label;

  const grade = document.createElement("span");
  grade.className = "col-grade-value";
  grade.textContent = gradeText;

  const weight = document.createElement("span");
  weight.className = "col-weight-value";

  const weightBold = document.createElement("b");
  weightBold.textContent = weightText;
  weight.appendChild(weightBold);

  row.append(assessment, grade, weight);
  return row;
}

function createSummaryRow(averageText, totalWeightText) {
  const row = document.createElement("li");
  row.className = "course-summary-row";

  const label = document.createElement("span");
  label.className = "col-assessment-name";
  label.innerHTML = "<b>Average:</b>";

  const average = document.createElement("span");
  average.className = "course-average-value";
  average.textContent = averageText;

  const totalWeight = document.createElement("span");
  totalWeight.className = "course-total-weight-value";
  totalWeight.textContent = totalWeightText;

  row.append(label, average, totalWeight);
  return row;
}

function createEmptyStateCard(message) {
  const card = document.createElement("div");
  card.className = "course-row-box";

  const header = createCourseBoxHeader("No courses");
  const list = document.createElement("ul");
  list.className = "category-list";

  const row = document.createElement("li");
  row.className = "course-summary-row";

  const text = document.createElement("span");
  text.className = "col-assessment-name";
  text.textContent = message;

  const spacerOne = document.createElement("span");
  const spacerTwo = document.createElement("span");

  row.append(text, spacerOne, spacerTwo);
  list.appendChild(row);
  card.append(header, list);
  return card;
}

async function getCurrentUser() {
  const cachedUser = sessionStorage.getItem(GRADES_STUDENT_USER_CACHE_KEY);
  if (cachedUser) {
    try {
      return JSON.parse(cachedUser);
    } catch (error) {
      sessionStorage.removeItem(GRADES_STUDENT_USER_CACHE_KEY);
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

  sessionStorage.setItem(GRADES_STUDENT_USER_CACHE_KEY, JSON.stringify(user));
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
      const response = await apiClient.getCourses({
        enabled: true,
      });

      const courses = (response?.courses || []).map((course) => ({
        courseOfferingId: course.courseOfferingId,
        courseCode: course.courseCode,
        courseName: course.courseName,
        section: course.section,
        instructorName: course.instructorName,
        credits: course.credits,
        term: course.term,
        isEnabled: course.isEnabled,
      }));
      sessionStorage.setItem(
        ENABLED_STUDENT_COURSES_CACHE_KEY,
        JSON.stringify(courses),
      );
      return courses;
    } catch (error) {
      console.warn("Node API grades course load failed, falling back to Supabase:", error);
    }
  }

  if (!supabaseClient) {
    throw new Error("Neither the Node API nor Supabase client is available.");
  }

  const { data, error } = await supabaseClient
    .from("available_courses")
    .select(
      "course_offering_id, course_code, course_name, section, instructor_name, credits, term, is_enabled",
    )
    .eq("is_enabled", true)
    .order("course_code", { ascending: true })
    .order("section", { ascending: true });

  if (error) {
    throw error;
  }

  const courses = (data || []).map((course) => ({
    courseOfferingId: course.course_offering_id,
    courseCode: course.course_code,
    courseName: course.course_name,
    section: course.section,
    instructorName: course.instructor_name,
    credits: course.credits,
    term: course.term,
    isEnabled: course.is_enabled,
  }));
  sessionStorage.setItem(
    ENABLED_STUDENT_COURSES_CACHE_KEY,
    JSON.stringify(courses),
  );
  return courses;
}

async function getRenderableCourses(currentUser, enabledCourses) {
  const savedCourses = await courseDataStore.loadStudentEnrollments(currentUser.id);
  const enabledCourseMap = new Map(
    enabledCourses.map((course) => [course.courseOfferingId, course]),
  );

  return savedCourses
    .map((course) => enabledCourseMap.get(course.courseOfferingId) || null)
    .filter(Boolean);
}

function sortAssessments(assessments) {
  return [...assessments].sort((left, right) => {
    return parseDueDateValue(left.dueDate) - parseDueDateValue(right.dueDate);
  });
}

function calculateCategoryGrade(assessments, courseProgress) {
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
    return "-";
  }

  return formatPercent(weightedSum / totalWeight, 2);
}

function calculateCategoryWeight(assessments) {
  const totalWeight = assessments.reduce((sum, assessment) => {
    const weight = parsePercent(assessment.weight);
    return weight === null ? sum : sum + weight;
  }, 0);

  return totalWeight > 0 ? formatPercent(totalWeight, 0) : "-";
}

function getMissingPlaceholder() {
  return "-";
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
    return "-";
  }

  return formatPercent(weightedSum / totalWeight, 2);
}

function calculateCourseTotalWeight(assessments) {
  const totalWeight = assessments.reduce((sum, assessment) => {
    const weight = parsePercent(assessment.weight);
    return weight === null ? sum : sum + weight;
  }, 0);

  return totalWeight > 0 ? formatPercent(totalWeight, 0) : "-";
}

function groupAssessmentsByCategory(assessments) {
  const groupedAssessments = Object.fromEntries(
    CATEGORY_CONFIG.map((category) => [category.key, []]),
  );

  sortAssessments(assessments).forEach((assessment) => {
    const categoryKey = getCategoryKeyFromAssessmentName(assessment.name);
    if (!categoryKey || !groupedAssessments[categoryKey]) {
      return;
    }

    groupedAssessments[categoryKey].push(assessment);
  });

  return groupedAssessments;
}

function createCourseCard(course, assessments, courseProgress) {
  const card = document.createElement("div");
  card.className = "course-row-box";

  const header = createCourseBoxHeader(course.courseCode);
  const list = document.createElement("ul");
  list.className = "category-list";
  const groupedAssessments = groupAssessmentsByCategory(assessments);

  CATEGORY_CONFIG.forEach((category) => {
    const categoryAssessments = groupedAssessments[category.key] || [];
    const gradeText =
      categoryAssessments.length > 0
        ? calculateCategoryGrade(categoryAssessments, courseProgress)
        : getMissingPlaceholder();
    const weightText =
      categoryAssessments.length > 0
        ? calculateCategoryWeight(categoryAssessments)
        : getMissingPlaceholder();

    list.appendChild(createCategoryRow(category.label, gradeText, weightText));
  });

  list.appendChild(
    createSummaryRow(
      calculateCourseAverage(assessments, courseProgress),
      calculateCourseTotalWeight(assessments),
    ),
  );

  card.append(header, list);
  return card;
}

function buildPrintableCourseSummary(course, assessments, courseProgress) {
  const groupedAssessments = groupAssessmentsByCategory(assessments);

  const rows = CATEGORY_CONFIG.map((category) => {
    const categoryAssessments = groupedAssessments[category.key] || [];
    return {
      label: category.label,
      gradeText:
        categoryAssessments.length > 0
          ? calculateCategoryGrade(categoryAssessments, courseProgress)
          : getMissingPlaceholder(),
      weightText:
        categoryAssessments.length > 0
          ? calculateCategoryWeight(categoryAssessments)
          : getMissingPlaceholder(),
    };
  });

  return {
    course,
    rows,
    averageText: calculateCourseAverage(assessments, courseProgress),
    totalWeightText: calculateCourseTotalWeight(assessments),
  };
}

function formatExportDate() {
  return new Date().toLocaleString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function openGradesPdfExport() {
  const { currentUser, courses } = gradesPageState;
  if (!currentUser || courses.length === 0) {
    window.alert("There are no grades available to export yet.");
    return;
  }

  const printableCourses = courses.map((course) => {
    const template = courseDataStore.getCourseTemplate(course.courseOfferingId);
    const courseProgress = courseDataStore.getStudentCourseProgress(
      currentUser.id,
      course.courseOfferingId,
    );
    return buildPrintableCourseSummary(course, template.assessments, courseProgress);
  });

  const fullName = `${String(currentUser.user_metadata?.first_name || "").trim()} ${String(currentUser.user_metadata?.last_name || "").trim()}`.trim();
  const studentLabel = fullName || currentUser.email || "Student";
  const coursesMarkup = printableCourses
    .map((courseSummary) => {
      const rowsMarkup = courseSummary.rows
        .map(
          (row) => `
            <tr>
              <td>${escapeHtml(row.label)}</td>
              <td>${escapeHtml(row.gradeText)}</td>
              <td>${escapeHtml(row.weightText)}</td>
            </tr>
          `,
        )
        .join("");

      return `
        <section class="pdf-course-section">
          <h2>${escapeHtml(courseSummary.course.courseCode)} - ${escapeHtml(courseSummary.course.courseName)}</h2>
          <p class="pdf-course-meta">
            Section: ${escapeHtml(courseSummary.course.section)} | Credits: ${escapeHtml(courseSummary.course.credits)}
          </p>
          <table>
            <thead>
              <tr>
                <th>Assessment Group</th>
                <th>Grade</th>
                <th>Weight</th>
              </tr>
            </thead>
            <tbody>
              ${rowsMarkup}
              <tr class="pdf-summary-row">
                <td>Average</td>
                <td>${escapeHtml(courseSummary.averageText)}</td>
                <td>${escapeHtml(courseSummary.totalWeightText)}</td>
              </tr>
            </tbody>
          </table>
        </section>
      `;
    })
    .join("");

  const exportMarkup = `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>Smart Course Companion Grades Export</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            color: #111827;
            margin: 32px;
          }
          h1 {
            margin: 0 0 8px;
            font-size: 28px;
          }
          .pdf-meta {
            margin: 0 0 24px;
            color: #4b5563;
            font-size: 14px;
          }
          .pdf-course-section {
            margin-bottom: 28px;
            page-break-inside: avoid;
          }
          .pdf-course-section h2 {
            margin: 0 0 6px;
            font-size: 20px;
          }
          .pdf-course-meta {
            margin: 0 0 12px;
            color: #4b5563;
            font-size: 14px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th, td {
            border: 1px solid #d1d5db;
            padding: 10px 12px;
            text-align: left;
            font-size: 14px;
          }
          th {
            background: #f3f4f6;
          }
          .pdf-summary-row td {
            font-weight: 700;
          }
          @media print {
            body {
              margin: 18px;
            }
          }
        </style>
      </head>
      <body>
        <h1>Grades Export</h1>
        <p class="pdf-meta">
          Student: ${escapeHtml(studentLabel)}<br />
          Exported: ${escapeHtml(formatExportDate())}
        </p>
        ${coursesMarkup}
      </body>
    </html>
  `;

  const printFrame = document.createElement("iframe");
  printFrame.style.position = "fixed";
  printFrame.style.right = "0";
  printFrame.style.bottom = "0";
  printFrame.style.width = "0";
  printFrame.style.height = "0";
  printFrame.style.border = "0";
  printFrame.setAttribute("aria-hidden", "true");

  const cleanupFrame = () => {
    window.setTimeout(() => {
      printFrame.remove();
    }, 1000);
  };

  printFrame.onload = () => {
    const frameWindow = printFrame.contentWindow;
    if (!frameWindow) {
      cleanupFrame();
      window.alert("Unable to prepare the PDF export.");
      return;
    }

    frameWindow.focus();
    frameWindow.print();
    cleanupFrame();
  };

  document.body.appendChild(printFrame);

  const frameDocument = printFrame.contentDocument;
  if (!frameDocument) {
    cleanupFrame();
    window.alert("Unable to prepare the PDF export.");
    return;
  }

  frameDocument.open();
  frameDocument.write(exportMarkup);
  frameDocument.close();
}

function renderCourseCards(courses, currentUser) {
  courseGradesContainer.innerHTML = "";
  gradesPageState.currentUser = currentUser;
  gradesPageState.courses = courses;

  courses.forEach((course) => {
    const template = courseDataStore.getCourseTemplate(course.courseOfferingId);
    const courseProgress = courseDataStore.getStudentCourseProgress(
      currentUser.id,
      course.courseOfferingId,
    );
    courseGradesContainer.appendChild(
      createCourseCard(course, template.assessments, courseProgress),
    );
  });
}

async function renderGradesPage() {
  if (!courseGradesContainer) {
    return;
  }

  courseGradesContainer.innerHTML = "";

  if (!supabaseClient || !courseDataStore) {
    gradesPageState.currentUser = null;
    gradesPageState.courses = [];
    courseGradesContainer.appendChild(
      createEmptyStateCard("Grades are unavailable right now."),
    );
    setPageTitle(0);
    return;
  }

  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return;
    }

    const cachedEnabledCourses = (() => {
      const rawValue = sessionStorage.getItem(ENABLED_STUDENT_COURSES_CACHE_KEY);
      if (!rawValue) {
        return [];
      }

      try {
        return JSON.parse(rawValue);
      } catch (error) {
        sessionStorage.removeItem(ENABLED_STUDENT_COURSES_CACHE_KEY);
        return [];
      }
    })();
    const cachedEnrollments = courseDataStore.getStudentEnrollments(currentUser.id);

    if (cachedEnabledCourses.length > 0 && cachedEnrollments.length > 0) {
      const cachedRenderableCourses = cachedEnrollments
        .map((course) =>
          cachedEnabledCourses.find(
            (enabledCourse) => enabledCourse.courseOfferingId === course.courseOfferingId,
          ) || null,
        )
        .filter(Boolean);

      if (cachedRenderableCourses.length > 0) {
        setPageTitle(cachedRenderableCourses.length);
        renderCourseCards(cachedRenderableCourses, currentUser);
      }
    }

    const enabledCourses = await loadEnabledCourses();
    const renderableCourses = await getRenderableCourses(currentUser, enabledCourses);

    setPageTitle(renderableCourses.length);

    if (renderableCourses.length === 0) {
      gradesPageState.currentUser = currentUser;
      gradesPageState.courses = [];
      courseGradesContainer.appendChild(
        createEmptyStateCard("No enabled dashboard courses to show."),
      );
      return;
    }

    await Promise.all(
      renderableCourses.map(async (course) => {
        await Promise.all([
          courseDataStore.loadCourseTemplate(course.courseOfferingId),
          courseDataStore.loadStudentCourseProgress(
            currentUser.id,
            course.courseOfferingId,
          ),
        ]);
      }),
    );

    renderCourseCards(renderableCourses, currentUser);
  } catch (error) {
    console.error("Unable to load student grades:", error);
    gradesPageState.currentUser = null;
    gradesPageState.courses = [];
    setPageTitle(0);
    courseGradesContainer.appendChild(
      createEmptyStateCard(error.message || "Unable to load your grades right now."),
    );
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (exportGradesPdfButton) {
    exportGradesPdfButton.addEventListener("click", openGradesPdfExport);
  }

  renderGradesPage();
});
