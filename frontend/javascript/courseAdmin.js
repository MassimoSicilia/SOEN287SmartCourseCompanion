const supabaseClient = window.supabaseClient;
const courseDataStore = window.CourseDataStore;
const courseTitle = document.getElementById("course-title");
const addAssignmentBtn = document.getElementById("addAssignmentBtn");
const editCourseBtn = document.getElementById("editCourseBtn");
const sortDueDateBtn = document.getElementById("sortDueDateBtn");
const container = document.querySelector(".container");
const categoriesBox = document.querySelector(".categories-box");
const templateActionMessage = document.getElementById("template-action-message");

const adminCourseState = {
  course: null,
  assessments: [],
  isEditMode: false,
  lastRemovedAssessment: null,
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

async function loadCourseFromSupabase(courseId) {
  if (!supabaseClient || !courseId) {
    return null;
  }

  const { data, error } = await supabaseClient
    .from("available_courses")
    .select(
      "course_offering_id, course_code, course_name, section, instructor_name, credits, term",
    )
    .eq("course_offering_id", courseId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    id: data.course_offering_id,
    code: data.course_code,
    name: data.course_name,
    section: data.section,
    instructorName: data.instructor_name,
    credits: data.credits,
    term: data.term,
  };
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
  const row = document.createElement("div");
  row.className = "assignment-row";
  row.dataset.assessmentId = assessment.id;
  row.append(
    createCell(assessment.name),
    createCell(assessment.weight),
    createCell(assessment.dueDate),
    createCell(""),
    createCell("--"),
  );
  return row;
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
}

function normalizeWeight(value) {
  const trimmedValue = String(value).replace("%", "").trim();
  if (!trimmedValue) {
    return null;
  }

  const numericValue = Number(trimmedValue);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return null;
  }

  return `${numericValue}%`;
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
      weightInput?.setCustomValidity("Enter a valid weight percentage.");
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
  );
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
      return;
    }
  }

  adminCourseState.assessments.sort((left, right) => {
    return parseDueDateValue(left.dueDate) - parseDueDateValue(right.dueDate);
  });

  await persistTemplate();
  renderAssessmentRows();
}

function applyCourseHeader() {
  if (!courseTitle || !adminCourseState.course) {
    return;
  }

  courseTitle.textContent = adminCourseState.course.code;
  document.title = `Smart Course Companion | ${adminCourseState.course.code}`;
}

async function initializeAdminCoursePage() {
  try {
    const selectedCourse = getSelectedAdminCourse();
    const courseId = getCourseIdFromQuery() || selectedCourse?.id || null;

    adminCourseState.course =
      (selectedCourse && (!courseId || selectedCourse.id === courseId))
        ? selectedCourse
        : await loadCourseFromSupabase(courseId);

    if (!adminCourseState.course) {
      throw new Error("No course was selected.");
    }

    sessionStorage.setItem(
      "selectedAdminCourse",
      JSON.stringify(adminCourseState.course),
    );

    const savedTemplate = await courseDataStore.loadCourseTemplate(
      adminCourseState.course.id,
    );
    adminCourseState.assessments = savedTemplate.assessments;

    applyCourseHeader();
    updateEditButtonLabel();
    renderAssessmentRows();
  } catch (error) {
    console.error("Unable to initialize admin course page:", error);
    alert(error.message || "Unable to load this course.");
  }
}

if (addAssignmentBtn) {
  addAssignmentBtn.addEventListener("click", addAssessment);
}

if (editCourseBtn) {
  editCourseBtn.addEventListener("click", toggleEditCourseDetails);
}

if (sortDueDateBtn) {
  sortDueDateBtn.addEventListener("click", sortAssessmentsByDueDate);
}

initializeAdminCoursePage();
