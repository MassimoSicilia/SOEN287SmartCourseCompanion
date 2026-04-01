const supabaseClient = window.supabaseClient;
const courseDataStore = window.CourseDataStore;
const inProgressBtn = document.getElementById("inProgressBtn");
const completedBtn = document.getElementById("completedBtn");
const inProgressContent = document.getElementById("inProgressContent");
const completedContent = document.getElementById("completedContent");
const sortDueDateBtn = document.getElementById("sortDueDateBtn");
const courseTitle = document.getElementById("course-title");
const courseStatusMessage = document.getElementById("courseStatusMessage");
const STATUS_OPTIONS = ["Not started", "In progress", "Submitted"];

const studentCourseState = {
  currentUser: null,
  course: null,
  assessments: [],
  progressByAssessmentId: {},
  isSortedByDueDate: false,
};

function setStatusMessage(message = "", isError = false) {
  if (!courseStatusMessage) {
    return;
  }

  courseStatusMessage.textContent = message;
  courseStatusMessage.classList.toggle("is-error", Boolean(isError));
}

function getCourseIdFromQuery() {
  const params = new URLSearchParams(window.location.search);
  return params.get("courseId");
}

function getSelectedStudentCourse() {
  const savedCourse = sessionStorage.getItem("selectedStudentCourse");
  if (!savedCourse) {
    return null;
  }

  try {
    return JSON.parse(savedCourse);
  } catch (error) {
    console.error("Unable to parse selected student course:", error);
    return null;
  }
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

function parseDueDateValue(value) {
  const timestamp = Date.parse(String(value).trim());
  return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
}

function getRenderableAssessments() {
  const assessments = [...studentCourseState.assessments];
  if (studentCourseState.isSortedByDueDate) {
    assessments.sort((left, right) => {
      return parseDueDateValue(left.dueDate) - parseDueDateValue(right.dueDate);
    });
  }

  return assessments;
}

function normalizeGradeText(value) {
  const trimmedValue = String(value || "").trim();
  if (!trimmedValue) {
    return "";
  }

  if (trimmedValue.includes("%")) {
    return trimmedValue;
  }

  if (/^\d+(\.\d+)?$/.test(trimmedValue)) {
    return `${trimmedValue}%`;
  }

  return trimmedValue;
}

function isValidGrade(value) {
  const cleanedValue = String(value || "").replace("%", "").trim();
  if (!cleanedValue) {
    return false;
  }

  const numericValue = Number(cleanedValue);
  return Number.isFinite(numericValue) && numericValue >= 0 && numericValue <= 100;
}

function getAssessmentProgress(assessmentId) {
  return (
    studentCourseState.progressByAssessmentId[assessmentId] || {
      grade: "",
      status: "Not started",
    }
  );
}

function persistAssessmentProgress(assessmentId, nextProgress) {
  if (!studentCourseState.currentUser || !studentCourseState.course) {
    return;
  }

  studentCourseState.progressByAssessmentId[assessmentId] = {
    grade: String(nextProgress.grade || "").trim(),
    status: String(nextProgress.status || "Not started").trim() || "Not started",
  };

  courseDataStore.saveStudentCourseProgress(
    studentCourseState.currentUser.id,
    studentCourseState.course.courseOfferingId,
    studentCourseState.progressByAssessmentId,
  );
}

function createCell(text) {
  const cell = document.createElement("div");
  cell.textContent = text;
  return cell;
}

function createCompletedStatusCell(assessmentId, statusText = "Submitted") {
  const statusCell = document.createElement("div");
  statusCell.className = "completed-status-cell";

  const statusLabel = document.createElement("span");
  statusLabel.textContent = statusText;

  const undoBtn = document.createElement("button");
  undoBtn.type = "button";
  undoBtn.className = "undo-btn";
  undoBtn.dataset.assessmentId = assessmentId;
  undoBtn.dataset.action = "undo-submitted";
  undoBtn.textContent = "Undo";

  statusCell.append(statusLabel, undoBtn);
  return statusCell;
}

function createInProgressRow(assessment) {
  const progress = getAssessmentProgress(assessment.id);
  const row = document.createElement("div");
  row.className = "assignment-row";
  row.dataset.assessmentId = assessment.id;

  const gradeInput = document.createElement("input");
  gradeInput.type = "text";
  gradeInput.placeholder = "e.g. 85%";
  gradeInput.className = "cell-input";
  gradeInput.value = progress.grade;

  const statusSelect = document.createElement("select");
  statusSelect.title = "Status";
  statusSelect.className = "cell-input";

  STATUS_OPTIONS.forEach((status) => {
    const option = document.createElement("option");
    option.value = status;
    option.textContent = status;
    statusSelect.appendChild(option);
  });

  statusSelect.value = STATUS_OPTIONS.includes(progress.status)
    ? progress.status
    : "Not started";

  row.append(
    createCell(assessment.name),
    createCell(assessment.weight),
    createCell(assessment.dueDate),
    gradeInput,
    statusSelect,
  );

  return row;
}

function createCompletedRow(assessment) {
  const progress = getAssessmentProgress(assessment.id);
  const row = document.createElement("div");
  row.className = "assignment-row";
  row.dataset.assessmentId = assessment.id;

  row.append(
    createCell(assessment.name),
    createCell(assessment.weight),
    createCell(assessment.dueDate),
    createCell(normalizeGradeText(progress.grade) || "N/A"),
    createCompletedStatusCell(assessment.id, progress.status || "Submitted"),
  );

  return row;
}

function createEmptyState(message) {
  const state = document.createElement("div");
  state.className = "assignment-row empty-assessment-row";
  state.append(
    createCell(message),
    createCell(""),
    createCell(""),
    createCell(""),
    createCell(""),
  );
  return state;
}

function renderAssessments() {
  if (!inProgressContent || !completedContent) {
    return;
  }

  inProgressContent.innerHTML = "";
  completedContent.innerHTML = "";

  const assessments = getRenderableAssessments();
  if (assessments.length === 0) {
    inProgressContent.appendChild(
      createEmptyState("No assessment template has been created for this course yet."),
    );
    completedContent.appendChild(
      createEmptyState("No completed assessments yet."),
    );
    return;
  }

  const inProgressAssessments = [];
  const completedAssessments = [];

  assessments.forEach((assessment) => {
    const progress = getAssessmentProgress(assessment.id);
    if (progress.status === "Submitted") {
      completedAssessments.push(assessment);
      return;
    }

    inProgressAssessments.push(assessment);
  });

  if (inProgressAssessments.length === 0) {
    inProgressContent.appendChild(
      createEmptyState("All current assessments are marked as submitted."),
    );
  } else {
    inProgressAssessments.forEach((assessment) => {
      inProgressContent.appendChild(createInProgressRow(assessment));
    });
  }

  if (completedAssessments.length === 0) {
    completedContent.appendChild(
      createEmptyState("No assessments have been submitted yet."),
    );
  } else {
    completedAssessments.forEach((assessment) => {
      completedContent.appendChild(createCompletedRow(assessment));
    });
  }
}

function setActiveTab(showCompleted) {
  if (
    !inProgressBtn ||
    !completedBtn ||
    !inProgressContent ||
    !completedContent
  ) {
    return;
  }

  inProgressContent.style.display = showCompleted ? "none" : "block";
  completedContent.style.display = showCompleted ? "block" : "none";
  inProgressBtn.classList.toggle("active", !showCompleted);
  completedBtn.classList.toggle("active", showCompleted);
}

function loadSelectedCourse() {
  const selectedCourse = getSelectedStudentCourse();
  const courseId = getCourseIdFromQuery();

  if (selectedCourse && (!courseId || selectedCourse.courseOfferingId === courseId)) {
    return selectedCourse;
  }

  if (!studentCourseState.currentUser || !courseId || !courseDataStore) {
    return null;
  }

  const enrolledCourses = courseDataStore.getStudentEnrollments(
    studentCourseState.currentUser.id,
  );

  return (
    enrolledCourses.find((course) => course.courseOfferingId === courseId) || null
  );
}

function applyCourseHeader() {
  if (!courseTitle || !studentCourseState.course) {
    return;
  }

  courseTitle.textContent = studentCourseState.course.courseCode;
  document.title = `Smart Course Companion | ${studentCourseState.course.courseCode}`;
}

function handleInProgressInput(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  const row = target.closest(".assignment-row");
  const assessmentId = row?.dataset.assessmentId;
  if (!assessmentId) {
    return;
  }

  const existingProgress = getAssessmentProgress(assessmentId);
  persistAssessmentProgress(assessmentId, {
    ...existingProgress,
    grade: target.value,
  });
}

function handleStatusChange(event) {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) {
    return;
  }

  const row = target.closest(".assignment-row");
  const assessmentId = row?.dataset.assessmentId;
  if (!assessmentId) {
    return;
  }

  const gradeInput = row.querySelector('input[type="text"]');
  const gradeValue = gradeInput?.value?.trim() || "";

  if (target.value === "Submitted" && !isValidGrade(gradeValue)) {
    target.value = "Not started";
    if (gradeInput instanceof HTMLInputElement) {
      gradeInput.setCustomValidity(
        "Please enter a grade between 0 and 100 before submitting.",
      );
      gradeInput.reportValidity();
      gradeInput.focus();
    }
    return;
  }

  if (gradeInput instanceof HTMLInputElement) {
    gradeInput.setCustomValidity("");
  }

  persistAssessmentProgress(assessmentId, {
    grade: normalizeGradeText(gradeValue),
    status: target.value,
  });
  renderAssessments();
}

function handleInProgressBlur(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  const row = target.closest(".assignment-row");
  const assessmentId = row?.dataset.assessmentId;
  if (!assessmentId) {
    return;
  }

  const normalizedGrade = normalizeGradeText(target.value);
  if (normalizedGrade && !isValidGrade(normalizedGrade)) {
    target.setCustomValidity("Please enter a valid number between 0 and 100.");
    target.reportValidity();
    return;
  }

  target.setCustomValidity("");
  target.value = normalizedGrade;

  const existingProgress = getAssessmentProgress(assessmentId);
  persistAssessmentProgress(assessmentId, {
    ...existingProgress,
    grade: normalizedGrade,
  });
}

function handleCompletedContentClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const undoButton = target.closest("[data-action='undo-submitted']");
  if (!(undoButton instanceof HTMLElement)) {
    return;
  }

  const assessmentId = undoButton.dataset.assessmentId;
  if (!assessmentId) {
    return;
  }

  const existingProgress = getAssessmentProgress(assessmentId);
  persistAssessmentProgress(assessmentId, {
    ...existingProgress,
    status: "In progress",
  });
  renderAssessments();
  setActiveTab(false);
}

async function initializeStudentCoursePage() {
  try {
    studentCourseState.currentUser = await getCurrentUser();
    if (!studentCourseState.currentUser) {
      return;
    }

    studentCourseState.course = loadSelectedCourse();
    if (!studentCourseState.course) {
      throw new Error("Open this page from a course on your dashboard.");
    }

    sessionStorage.setItem(
      "selectedStudentCourse",
      JSON.stringify(studentCourseState.course),
    );

    const template = courseDataStore.getCourseTemplate(
      studentCourseState.course.courseOfferingId,
    );

    studentCourseState.assessments = template.assessments;
    studentCourseState.progressByAssessmentId = courseDataStore.getStudentCourseProgress(
      studentCourseState.currentUser.id,
      studentCourseState.course.courseOfferingId,
    );

    applyCourseHeader();
    renderAssessments();
    setActiveTab(false);

    if (studentCourseState.assessments.length === 0) {
      setStatusMessage(
        "Your instructor has not added the course assessment template yet.",
      );
      return;
    }

    setStatusMessage("");
  } catch (error) {
    console.error("Unable to initialize student course page:", error);
    setStatusMessage(error.message || "Unable to load this course.", true);
  }
}

if (inProgressBtn && completedBtn) {
  inProgressBtn.addEventListener("click", () => setActiveTab(false));
  completedBtn.addEventListener("click", () => setActiveTab(true));
}

if (inProgressContent) {
  inProgressContent.addEventListener("change", handleStatusChange);
  inProgressContent.addEventListener("input", handleInProgressInput);
  inProgressContent.addEventListener("focusout", handleInProgressBlur);
}

if (completedContent) {
  completedContent.addEventListener("click", handleCompletedContentClick);
}

if (sortDueDateBtn) {
  sortDueDateBtn.addEventListener("click", () => {
    studentCourseState.isSortedByDueDate = true;
    renderAssessments();
  });
}

initializeStudentCoursePage();
