const supabaseClient = window.supabaseClient;
const courseDataStore = window.CourseDataStore;
const apiClient = window.SmartCourseApi;
const courseTitle = document.getElementById("course-title");
const addAssignmentBtn = document.getElementById("addAssignmentBtn");
const editCourseBtn = document.getElementById("editCourseBtn");
const saveTemplateBtn = document.getElementById("saveTemplateBtn");
const sortDueDateBtn = document.getElementById("sortDueDateBtn");
const container = document.querySelector(".container");
const categoriesBox = document.querySelector(".categories-box");
const templateActionMessage = document.getElementById("template-action-message");
const assessmentWeightMessage = document.getElementById("assessment-weight-message");
const COURSE_ADMIN_USER_ID_CACHE_KEY = "smartCurrentAdminUserId";

const adminCourseState = {
  course: null,
  assessments: [],
  isEditMode: false,
  lastRemovedAssessment: null,
  submissionSummaryByAssessmentId: {},
};

function getCourseIdFromQuery() {
  const params = new URLSearchParams(window.location.search);
  return params.get("courseId");
}

function getSelectedAdminCourse() {
  const savedCourse = sessionStorage.getItem("selectedAdminCourse");
  if (!savedCourse) {
    return null;
  }

  try {
    return JSON.parse(savedCourse);
  } catch (error) {
    console.error("Unable to parse selected admin course:", error);
    return null;
  }
}

function getPendingSelectedAdminCourse() {
  const selectedCourse = getSelectedAdminCourse();
  const courseId = getCourseIdFromQuery();

  if (!selectedCourse) {
    return null;
  }

  if (courseId && selectedCourse.id !== courseId) {
    return null;
  }

  return selectedCourse;
}

async function loadCourseFromApi(courseId) {
  if (!apiClient || !courseId) {
    return null;
  }

  const data = await apiClient.getCourse(courseId);
  if (!data) {
    return null;
  }

  return {
    id: data.courseOfferingId,
    code: data.courseCode,
    name: data.courseName,
    section: data.section,
    instructorName: data.instructorName,
    credits: data.credits,
    term: data.term,
  };
}

async function getCurrentAdminUserId() {
  const cachedUserId = sessionStorage.getItem(COURSE_ADMIN_USER_ID_CACHE_KEY);
  if (cachedUserId) {
    return cachedUserId;
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
    throw new Error("You must be logged in to save a template.");
  }

  sessionStorage.setItem(COURSE_ADMIN_USER_ID_CACHE_KEY, user.id);
  return user.id;
}

function createCell(content) {
  const cell = document.createElement("div");
  if (content instanceof Node) {
    cell.appendChild(content);
    return cell;
  }

  cell.textContent = content;
  return cell;
}

function buildAssessmentInput(value = "", placeholder = "", inputType = "text") {
  const input = document.createElement("input");
  input.type = inputType;
  input.className = "assessment-input";
  input.value = value;
  input.placeholder = placeholder;
  return input;
}

function clearAssessmentRows() {
  container?.querySelectorAll(".assignment-row").forEach((row) => row.remove());
}

function createEmptyRow() {
  const row = document.createElement("div");
  row.className = "assignment-row empty-assessment-row";
  row.append(
    createCell("No assessments have been added yet."),
    createCell(""),
    createCell(""),
    createCell(""),
    createCell("--"),
  );
  return row;
}

function createDisplayRow(assessment) {
  const submissionSummary = courseDataStore.getAssessmentSubmissionSummary(
    adminCourseState.course?.id,
    assessment.id,
  );
  const row = document.createElement("div");
  row.className = "assignment-row";
  row.dataset.assessmentId = assessment.id;
  row.append(
    createCell(assessment.name),
    createCell(assessment.weight),
    createCell(assessment.dueDate),
    createCell(submissionSummary.completionStatusText),
    createCell(submissionSummary.completionRateText),
  );
  return row;
}

function setAssessmentWeightMessage(message = "", isError = false) {
  if (!assessmentWeightMessage) {
    return;
  }

  assessmentWeightMessage.textContent = message;
  assessmentWeightMessage.classList.toggle("is-error", Boolean(isError));
}

function renderTemplateActionMessage() {
  if (!templateActionMessage) {
    return;
  }

  templateActionMessage.innerHTML = "";

  if (!adminCourseState.isEditMode || !adminCourseState.lastRemovedAssessment) {
    return;
  }

  const banner = document.createElement("div");
  banner.className = "template-action-banner";

  const message = document.createElement("span");
  message.textContent = `"${adminCourseState.lastRemovedAssessment.assessment.name || "Assessment"}" removed.`;

  const undoButton = document.createElement("button");
  undoButton.type = "button";
  undoButton.textContent = "Undo";
  undoButton.addEventListener("click", undoRemoveAssessment);

  banner.append(message, undoButton);
  templateActionMessage.appendChild(banner);
}

function removeAssessment(assessmentId) {
  const assessmentIndex = adminCourseState.assessments.findIndex(
    (assessment) => assessment.id === assessmentId,
  );

  if (assessmentIndex === -1) {
    return;
  }

  const [removedAssessment] = adminCourseState.assessments.splice(assessmentIndex, 1);
  adminCourseState.lastRemovedAssessment = {
    assessment: removedAssessment,
    index: assessmentIndex,
  };
  renderTemplateActionMessage();
  renderAssessmentRows();
}

function undoRemoveAssessment() {
  if (!adminCourseState.lastRemovedAssessment) {
    return;
  }

  const { assessment, index } = adminCourseState.lastRemovedAssessment;
  const safeIndex = Math.max(0, Math.min(index, adminCourseState.assessments.length));
  adminCourseState.assessments.splice(safeIndex, 0, assessment);
  adminCourseState.lastRemovedAssessment = null;
  renderTemplateActionMessage();
  renderAssessmentRows();
}

function createEditableRow(assessment) {
  const row = document.createElement("div");
  row.className = "assignment-row";
  row.dataset.assessmentId = assessment.id;

  const nameInput = buildAssessmentInput(
    assessment.name,
    "Assessment name",
    "text",
  );
  const weightInput = buildAssessmentInput(assessment.weight, "Weight %", "text");
  weightInput.inputMode = "decimal";
  const dueDateInput = buildAssessmentInput(assessment.dueDate, "", "date");
  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "assessment-remove-btn";
  removeButton.textContent = "Remove";
  removeButton.addEventListener("click", () => removeAssessment(assessment.id));

  row.append(
    createCell(nameInput),
    createCell(weightInput),
    createCell(dueDateInput),
    createCell(""),
    createCell(removeButton),
  );
  return row;
}

function renderAssessmentRows() {
  if (!container || !categoriesBox) {
    return;
  }

  clearAssessmentRows();

  if (adminCourseState.assessments.length === 0) {
    categoriesBox.insertAdjacentElement("afterend", createEmptyRow());
    renderTemplateActionMessage();
    return;
  }

  let previousNode = categoriesBox;
  adminCourseState.assessments.forEach((assessment) => {
    const row = adminCourseState.isEditMode
      ? createEditableRow(assessment)
      : createDisplayRow(assessment);
    previousNode.insertAdjacentElement("afterend", row);
    previousNode = row;
  });
  renderTemplateActionMessage();
  if (!adminCourseState.isEditMode) {
    setAssessmentWeightMessage("");
  } else {
    updateWeightValidationMessage();
  }
}

function normalizeWeight(value) {
  const trimmedValue = String(value).replace("%", "").trim();
  if (!trimmedValue) {
    return null;
  }

  const numericValue = Number(trimmedValue);
  if (!Number.isFinite(numericValue) || numericValue < 0 || numericValue > 100) {
    return null;
  }

  return `${numericValue}%`;
}

function parseWeightNumber(weight) {
  const numericValue = Number(String(weight || "").replace("%", "").trim());
  return Number.isFinite(numericValue) ? numericValue : null;
}

function validateAssessmentWeightTotals(assessments) {
  const totalWeight = assessments.reduce((sum, assessment) => {
    const numericWeight = parseWeightNumber(assessment.weight);
    return numericWeight === null ? sum : sum + numericWeight;
  }, 0);

  if (totalWeight > 100) {
    throw new Error(
      `The total assessment weight cannot exceed 100%. Current total: ${totalWeight}%.`,
    );
  }

  return totalWeight;
}

function updateWeightValidationMessage() {
  if (!adminCourseState.isEditMode) {
    setAssessmentWeightMessage("");
    return;
  }

  const rows = Array.from(container?.querySelectorAll(".assignment-row") || []).filter(
    (row) => !row.classList.contains("empty-assessment-row"),
  );

  const totalWeight = rows.reduce((sum, row) => {
    const weightInput = row.querySelector('input[placeholder="Weight %"]');
    const numericWeight = parseWeightNumber(weightInput?.value || "");
    return numericWeight === null ? sum : sum + numericWeight;
  }, 0);

  if (totalWeight > 100) {
    setAssessmentWeightMessage(
      `Total assessment weight is ${totalWeight}%. It must stay at or below 100%.`,
      true,
    );
    return;
  }

  if (rows.length === 0) {
    setAssessmentWeightMessage("");
    return;
  }

  setAssessmentWeightMessage(`Current total weight: ${totalWeight}%.`);
}

function collectAssessmentsFromInputs() {
  const rows = Array.from(container?.querySelectorAll(".assignment-row") || []).filter(
    (row) => !row.classList.contains("empty-assessment-row"),
  );

  const nextAssessments = rows.map((row) => {
    const inputs = row.querySelectorAll("input");
    const [nameInput, weightInput, dueDateInput] = inputs;
    const name = nameInput?.value.trim() || "";
    const weight = normalizeWeight(weightInput?.value || "");
    const dueDate = dueDateInput?.value.trim() || "";

    if (!name) {
      nameInput?.setCustomValidity("Enter an assessment name.");
      nameInput?.reportValidity();
      throw new Error("Assessment name is required.");
    }

    nameInput?.setCustomValidity("");

    if (!weight) {
      if (weightInput instanceof HTMLInputElement) {
        weightInput.value = "";
      }
      weightInput?.setCustomValidity("Enter a valid weight percentage between 0 and 100.");
      weightInput?.reportValidity();
      throw new Error("Assessment weight is required.");
    }

    weightInput?.setCustomValidity("");

    if (!dueDate) {
      dueDateInput?.setCustomValidity("Choose a due date.");
      dueDateInput?.reportValidity();
      throw new Error("Assessment due date is required.");
    }

    dueDateInput?.setCustomValidity("");

    return {
      id: row.dataset.assessmentId || courseDataStore.createAssessmentId(),
      name,
      weight,
      dueDate,
    };
  });

  const totalWeight = validateAssessmentWeightTotals(nextAssessments);
  setAssessmentWeightMessage(`Current total weight: ${totalWeight}%.`);

  return nextAssessments;
}

function updateEditButtonLabel() {
  if (!editCourseBtn) {
    return;
  }

  editCourseBtn.textContent = adminCourseState.isEditMode
    ? "Save Course Details"
    : "Edit Course Details";
}

async function persistTemplate() {
  if (!adminCourseState.course || !courseDataStore) {
    return;
  }

  await courseDataStore.saveCourseTemplateEverywhere(
    adminCourseState.course.id,
    adminCourseState.assessments,
    adminCourseState.course.code,
  );
}

async function saveAsReusableTemplate() {
  if (!adminCourseState.course || !courseDataStore) {
    return;
  }

  try {
    let assessmentsToSave = adminCourseState.assessments;
    if (adminCourseState.isEditMode) {
      assessmentsToSave = collectAssessmentsFromInputs();
      adminCourseState.assessments = assessmentsToSave;
      renderAssessmentRows();
    }

    if (assessmentsToSave.length === 0) {
      alert("Add at least one assessment before saving a reusable template.");
      return;
    }

    const defaultTemplateName = `${adminCourseState.course.code} Template`;
    const templateName = window.prompt(
      "Template name:",
      defaultTemplateName,
    )?.trim();

    if (!templateName) {
      return;
    }

    const templateSummary = window.prompt(
      "Optional template description:",
      `Reusable assessment structure for ${adminCourseState.course.code}`,
    )?.trim() || "";

    const adminUserId = await getCurrentAdminUserId();
    await courseDataStore.saveReusableTemplate({
      templateName,
      templateSummary,
      createdByUserId: adminUserId,
      assessments: assessmentsToSave,
      sourceCourseId: adminCourseState.course.id,
      sourceCourseCode: adminCourseState.course.code,
    });

    alert(`Reusable template "${templateName}" saved.`);
  } catch (error) {
    console.error("Unable to save reusable template:", error);
    alert(error.message || "Unable to save this reusable template.");
  }
}

async function toggleEditCourseDetails() {
  if (!adminCourseState.isEditMode) {
    adminCourseState.isEditMode = true;
    adminCourseState.lastRemovedAssessment = null;
    updateEditButtonLabel();
    renderAssessmentRows();
    return;
  }

  try {
    adminCourseState.assessments = collectAssessmentsFromInputs();
    adminCourseState.isEditMode = false;
    adminCourseState.lastRemovedAssessment = null;
    await persistTemplate();
    updateEditButtonLabel();
    renderAssessmentRows();
  } catch (error) {
    console.error("Unable to save course template:", error);
    adminCourseState.isEditMode = true;
    updateEditButtonLabel();
    updateWeightValidationMessage();
    alert(error.message || "Unable to save this course template.");
  }
}

function addAssessment() {
  adminCourseState.isEditMode = true;
  adminCourseState.lastRemovedAssessment = null;
  adminCourseState.assessments.push({
    id: courseDataStore.createAssessmentId(),
    name: "",
    weight: "",
    dueDate: "",
  });
  updateEditButtonLabel();
  renderAssessmentRows();
}

function parseDueDateValue(value) {
  const timestamp = Date.parse(String(value).trim());
  return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
}

async function sortAssessmentsByDueDate() {
  if (adminCourseState.isEditMode) {
    try {
      adminCourseState.assessments = collectAssessmentsFromInputs();
    } catch (error) {
      alert(error.message || "Unable to sort assessments until the current rows are valid.");
      return;
    }
  }

  adminCourseState.assessments.sort((left, right) => {
    return parseDueDateValue(left.dueDate) - parseDueDateValue(right.dueDate);
  });

  try {
    await persistTemplate();
    renderAssessmentRows();
  } catch (error) {
    console.error("Unable to save sorted course template:", error);
    alert(error.message || "Unable to save the sorted assessments.");
  }
}

function applyCourseHeader() {
  if (!courseTitle || !adminCourseState.course) {
    return;
  }

  courseTitle.textContent = adminCourseState.course.code;
  document.title = `Smart Course Companion | ${adminCourseState.course.code}`;
}

function applyPendingCourseHeader() {
  const pendingCourse = getPendingSelectedAdminCourse();
  if (!pendingCourse) {
    return;
  }

  adminCourseState.course = pendingCourse;
  applyCourseHeader();
}

async function initializeAdminCoursePage() {
  try {
    applyPendingCourseHeader();

    const selectedCourse = getPendingSelectedAdminCourse();
    const courseId = getCourseIdFromQuery() || selectedCourse?.id || null;

    if (!adminCourseState.course) {
      adminCourseState.course =
        (selectedCourse && (!courseId || selectedCourse.id === courseId))
          ? selectedCourse
          : await loadCourseFromApi(courseId);
    }

    if (!adminCourseState.course) {
      throw new Error("No course was selected.");
    }

    sessionStorage.setItem(
      "selectedAdminCourse",
      JSON.stringify(adminCourseState.course),
    );

    applyCourseHeader();
    adminCourseState.assessments = courseDataStore.getCourseTemplate(
      adminCourseState.course.id,
    ).assessments;
    renderAssessmentRows();

    const templatePromise = courseDataStore.loadCourseTemplate(
      adminCourseState.course.id,
    );
    const submissionSummaryPromise = courseDataStore.loadCourseSubmissionSummaries(
      adminCourseState.course.id,
    );

    const savedTemplate = await templatePromise;
    adminCourseState.assessments = savedTemplate.assessments;
    renderAssessmentRows();

    adminCourseState.submissionSummaryByAssessmentId =
      await submissionSummaryPromise;

    updateEditButtonLabel();
    renderAssessmentRows();
  } catch (error) {
    console.error("Unable to initialize admin course page:", error);
    alert(error.message || "Unable to load this course.");
  }
}

window.addEventListener("storage", (event) => {
  if (
    event.key === "smartStudentEnrollments" ||
    event.key === "smartStudentAssessmentProgress"
  ) {
    renderAssessmentRows();
  }
});

if (addAssignmentBtn) {
  addAssignmentBtn.addEventListener("click", addAssessment);
}

if (editCourseBtn) {
  editCourseBtn.addEventListener("click", toggleEditCourseDetails);
}

if (saveTemplateBtn) {
  saveTemplateBtn.addEventListener("click", saveAsReusableTemplate);
}

if (sortDueDateBtn) {
  sortDueDateBtn.addEventListener("click", sortAssessmentsByDueDate);
}

if (container) {
  container.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    if (!target.classList.contains("assessment-input")) {
      return;
    }

    updateWeightValidationMessage();
  });
}

initializeAdminCoursePage();
