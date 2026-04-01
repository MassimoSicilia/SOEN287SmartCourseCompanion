const supabaseClient = window.supabaseClient;
const courseDataStore = window.CourseDataStore;
const courseGradesContainer = document.querySelector(".course-grades");
const pageTitle = document.querySelector(".container h1");

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

  return user;
}

async function loadEnabledCourses() {
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

  return (data || []).map((course) => ({
    courseOfferingId: course.course_offering_id,
    courseCode: course.course_code,
    courseName: course.course_name,
    section: course.section,
    instructorName: course.instructor_name,
    credits: course.credits,
    term: course.term,
    isEnabled: course.is_enabled,
  }));
}

function getRenderableCourses(currentUser, enabledCourses) {
  const savedCourses = courseDataStore.getStudentEnrollments(currentUser.id);
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

async function renderGradesPage() {
  if (!courseGradesContainer) {
    return;
  }

  courseGradesContainer.innerHTML = "";

  if (!supabaseClient || !courseDataStore) {
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

    const enabledCourses = await loadEnabledCourses();
    const renderableCourses = getRenderableCourses(currentUser, enabledCourses);

    setPageTitle(renderableCourses.length);

    if (renderableCourses.length === 0) {
      courseGradesContainer.appendChild(
        createEmptyStateCard("No enabled dashboard courses to show."),
      );
      return;
    }

    const courseCards = await Promise.all(
      renderableCourses.map(async (course) => {
        const template = await courseDataStore.loadCourseTemplate(
          course.courseOfferingId,
        );
        const courseProgress = courseDataStore.getStudentCourseProgress(
          currentUser.id,
          course.courseOfferingId,
        );

        return createCourseCard(course, template.assessments, courseProgress);
      }),
    );

    courseCards.forEach((card) => {
      courseGradesContainer.appendChild(card);
    });
  } catch (error) {
    console.error("Unable to load student grades:", error);
    setPageTitle(0);
    courseGradesContainer.appendChild(
      createEmptyStateCard(error.message || "Unable to load your grades right now."),
    );
  }
}

document.addEventListener("DOMContentLoaded", () => {
  renderGradesPage();
});
