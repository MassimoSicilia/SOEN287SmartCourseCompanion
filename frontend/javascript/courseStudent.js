const inProgressBtn = document.getElementById("inProgressBtn");
const completedBtn = document.getElementById("completedBtn");
const inProgressContent = document.getElementById("inProgressContent");
const completedContent = document.getElementById("completedContent");
const sortDueDateBtn = document.getElementById("sortDueDateBtn");
const STATUS_OPTIONS = ["Not started", "In progress", "Submitted"];

function parseDueDateValue(value) {
  const timestamp = Date.parse(String(value).trim());
  return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
}

function sortRowsByDueDate(container) {
  if (!container) {
    return;
  }

  const rows = Array.from(
    container.querySelectorAll(":scope > .assignment-row"),
  );
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

function createStatusSelect(selectedValue = "") {
  const select = document.createElement("select");
  select.className = "cell-input";

  STATUS_OPTIONS.forEach((status) => {
    const option = document.createElement("option");
    option.value = status;
    option.textContent = status;
    select.appendChild(option);
  });

  select.value = selectedValue;
  return select;
}

function createCompletedStatusCell(statusText = "Submitted") {
  const statusCell = document.createElement("div");
  statusCell.className = "completed-status-cell";

  const statusLabel = document.createElement("span");
  statusLabel.textContent = statusText;

  const undoBtn = document.createElement("button");
  undoBtn.type = "button";
  undoBtn.className = "undo-btn";
  undoBtn.dataset.action = "undo-submitted";
  undoBtn.textContent = "Undo";

  statusCell.append(statusLabel, undoBtn);
  return statusCell;
}

function handleCompletedContentClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const actionEl = target.closest("[data-action='undo-submitted']");
  if (!actionEl) {
    return;
  }

  const row = actionEl.closest(".assignment-row");
  moveRowToInProgress(row);
}

function moveRowToInProgress(row) {
  if (!row || !inProgressContent) {
    return;
  }

  const name = row.children[0]?.textContent?.trim() ?? "";
  const weight = row.children[1]?.textContent?.trim() ?? "";
  const dueDate = row.children[2]?.textContent?.trim() ?? "";
  const grade = row.children[3]?.textContent?.trim() ?? "";

  row.innerHTML = "";
  row.append(createCell(name), createCell(weight), createCell(dueDate));

  const gradeInput = document.createElement("input");
  gradeInput.type = "text";
  gradeInput.placeholder = "e.g. 85%";
  gradeInput.className = "cell-input";
  gradeInput.value = grade;

  row.append(gradeInput, createStatusSelect("In progress"));
  inProgressContent.appendChild(row);
}

function decorateCompletedRow(row) {
  if (!row) {
    return;
  }

  const statusCell = row.children[4];
  if (!statusCell || statusCell.querySelector(".undo-btn")) {
    return;
  }

  const statusText = statusCell.textContent.trim() || "Submitted";
  statusCell.replaceWith(createCompletedStatusCell(statusText));
}

function decorateCompletedRows() {
  if (!completedContent) {
    return;
  }

  const rows = completedContent.querySelectorAll(":scope > .assignment-row");
  rows.forEach((row) => decorateCompletedRow(row));
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

function clearGradeError(gradeInput) {
  if (gradeInput instanceof HTMLInputElement) {
    gradeInput.setCustomValidity("");
  }
}

function getGradeInput(targetOrEvent) {
  if (targetOrEvent instanceof HTMLInputElement) {
    return targetOrEvent;
  }

  if (
    targetOrEvent &&
    targetOrEvent.target &&
    targetOrEvent.target instanceof HTMLInputElement
  ) {
    return targetOrEvent.target;
  }

  return null;
}

function removePercentSymbol(value) {
  const trimmedValue = value.trim();
  if (trimmedValue.endsWith("%")) {
    return trimmedValue.slice(0, -1).trim();
  }

  return trimmedValue;
}

function strictCoursePercent(targetOrEvent) {
  const gradeInput = getGradeInput(targetOrEvent);
  if (!gradeInput) {
    return false;
  }

  const rawValue = gradeInput.value.trim();
  if (!rawValue) {
    gradeInput.setCustomValidity("Please enter a grade between 0 and 100.");
    return false;
  }

  const cleanedValue = removePercentSymbol(rawValue);
  const numericPattern = /^\d+(\.\d+)?$/;
  if (!numericPattern.test(cleanedValue)) {
    gradeInput.setCustomValidity(
      "Please enter a valid number between 0 and 100.",
    );
    return false;
  }

  const numericValue = Number(cleanedValue);
  if (!Number.isFinite(numericValue) || numericValue < 0 || numericValue > 100) {
    gradeInput.setCustomValidity(
      "Please enter a valid number between 0 and 100.",
    );
    return false;
  }

  gradeInput.setCustomValidity("");
  gradeInput.value = `${numericValue}%`;
  return true;
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
    createCompletedStatusCell(status),
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
    target.value = "Not started";

    if (gradeInput instanceof HTMLInputElement) {
      gradeInput.setCustomValidity(
        "Please enter a grade before marking this assessment as Submitted.",
      );
      gradeInput.reportValidity();
      gradeInput.focus();
    }
    return;
  }

  if (!strictCoursePercent(gradeInput)) {
    target.value = "Not started";
    if (gradeInput instanceof HTMLInputElement) {
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

function handleInProgressBlur(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  if (target.matches('input[type="text"]')) {
    strictCoursePercent(target);
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
  sortDueDateBtn.addEventListener("click", sortStudentAssignmentsByDueDate);
}

decorateCompletedRows();
setActiveTab(false);
