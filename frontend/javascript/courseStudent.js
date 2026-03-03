const inProgressBtn = document.getElementById("inProgressBtn");
const completedBtn = document.getElementById("completedBtn");
const inProgressContent = document.getElementById("inProgressContent");
const completedContent = document.getElementById("completedContent");
const sortDueDateBtn = document.getElementById("sortDueDateBtn");
const editGradesBtn = document.getElementById("editGrades");
let isEditingCompletedGrades = false;

function parseDueDateValue(value) {
  const timestamp = Date.parse(String(value).trim());
  return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
}

function sortRowsByDueDate(container) {
  if (!container) {
    return;
  }

  const rows = Array.from(container.querySelectorAll(":scope > .assignment-row"));
  rows.sort((a, b) => {
    const aDate = parseDueDateValue(a.children[2]?.textContent ?? "");
    const bDate = parseDueDateValue(b.children[2]?.textContent ?? "");
    return aDate - bDate;
  });

  rows.forEach((row) => container.appendChild(row));
}

function sortStudentAssignmentsByDueDate() {
  sortRowsByDueDate(inProgressContent);
  sortRowsByDueDate(completedContent);
}

function createCell(text) {
  const cell = document.createElement("div");
  cell.textContent = text;
  return cell;
}

function normalizeGradeText(value) {
  const trimmed = String(value).trim();
  if (!trimmed) {
    return trimmed;
  }

  if (trimmed.includes("%")) {
    return trimmed;
  }

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return `${trimmed}%`;
  }

  return trimmed;
}

function setEditGradesButtonVisibility(showCompleted) {
  if (!editGradesBtn) {
    return;
  }

  editGradesBtn.style.display = showCompleted ? "inline-flex" : "none";
}

function enterCompletedGradesEditMode() {
  if (!completedContent) {
    return;
  }

  const rows = completedContent.querySelectorAll(":scope > .assignment-row");
  rows.forEach((row) => {
    const gradeCell = row.children[3];
    if (!gradeCell || gradeCell.querySelector("input")) {
      return;
    }

    const input = document.createElement("input");
    input.type = "text";
    input.className = "cell-input";
    input.value = gradeCell.textContent.trim();
    input.placeholder = "e.g. 85%";

    gradeCell.textContent = "";
    gradeCell.appendChild(input);
  });

  isEditingCompletedGrades = true;
  if (editGradesBtn) {
    editGradesBtn.textContent = "Save Grades";
  }
}

function exitCompletedGradesEditMode() {
  if (!completedContent) {
    return;
  }

  const rows = completedContent.querySelectorAll(":scope > .assignment-row");
  rows.forEach((row) => {
    const gradeCell = row.children[3];
    const gradeInput = gradeCell?.querySelector("input");
    if (!gradeInput) {
      return;
    }

    gradeCell.textContent = normalizeGradeText(gradeInput.value);
  });

  isEditingCompletedGrades = false;
  if (editGradesBtn) {
    editGradesBtn.textContent = "Edit Grades";
  }
}

function toggleCompletedGradesEditMode() {
  if (isEditingCompletedGrades) {
    exitCompletedGradesEditMode();
    return;
  }

  enterCompletedGradesEditMode();
}

function clearGradeError(gradeInput) {
  if (gradeInput instanceof HTMLInputElement) {
    gradeInput.setCustomValidity("");
  }
}

function moveRowToCompleted(row) {
  if (!row || !completedContent) {
    return;
  }

  const name = row.children[0]?.textContent?.trim() ?? "";
  const weight = row.children[1]?.textContent?.trim() ?? "";
  const dueDate = row.children[2]?.textContent?.trim() ?? "";
  const gradeInput = row.querySelector('input[type="text"]');
  const statusSelect = row.querySelector("select");

  const grade = gradeInput?.value?.trim() || "N/A";
  const status = statusSelect?.value?.trim() || "Submitted";

  row.innerHTML = "";
  row.append(
    createCell(name),
    createCell(weight),
    createCell(dueDate),
    createCell(normalizeGradeText(grade)),
    createCell(status)
  );

  completedContent.appendChild(row);
}

function handleStatusChange(event) {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) {
    return;
  }

  if (target.value !== "Submitted") {
    return;
  }

  const row = target.closest(".assignment-row");
  const gradeInput = row?.querySelector('input[type="text"]');
  const gradeValue = gradeInput?.value?.trim() ?? "";

  if (!gradeValue) {
    target.value = "";

    if (gradeInput instanceof HTMLInputElement) {
      gradeInput.setCustomValidity(
        "Please enter a grade before marking this assessment as Submitted."
      );
      gradeInput.reportValidity();
      gradeInput.focus();
    }

    return;
  }

  clearGradeError(gradeInput);
  moveRowToCompleted(row);
}

function handleInProgressInput(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  if (target.matches('input[type="text"]')) {
    clearGradeError(target);
  }
}

function setActiveTab(showCompleted) {
  if (!inProgressBtn || !completedBtn || !inProgressContent || !completedContent) {
    return;
  }

  if (!showCompleted && isEditingCompletedGrades) {
    exitCompletedGradesEditMode();
  }

  inProgressContent.style.display = showCompleted ? "none" : "block";
  completedContent.style.display = showCompleted ? "block" : "none";
  inProgressBtn.classList.toggle("active", !showCompleted);
  completedBtn.classList.toggle("active", showCompleted);
  setEditGradesButtonVisibility(showCompleted);
}

if (inProgressBtn && completedBtn) {
  inProgressBtn.addEventListener("click", () => setActiveTab(false));
  completedBtn.addEventListener("click", () => setActiveTab(true));
}

if (inProgressContent) {
  inProgressContent.addEventListener("change", handleStatusChange);
  inProgressContent.addEventListener("input", handleInProgressInput);
}

if (sortDueDateBtn) {
  sortDueDateBtn.addEventListener("click", sortStudentAssignmentsByDueDate);
}

if (editGradesBtn) {
  editGradesBtn.addEventListener("click", toggleCompletedGradesEditMode);
}

setActiveTab(false);
