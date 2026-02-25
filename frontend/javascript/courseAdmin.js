function calculateCompletionRate() {
  const assignmentRows = document.querySelectorAll(".assignment-row");

  assignmentRows.forEach((row) => {
    if (row.classList.contains("add-assessment-row")) {
      return;
    }

    const cells = row.querySelectorAll(":scope > div");
    const completionStatusCell = cells[3];
    const completionRateCell = cells[4];

    if (!completionStatusCell || !completionRateCell) {
      return;
    }

    const completionStatusInput = completionStatusCell.querySelector("input");
    const statusText = completionStatusInput
      ? completionStatusInput.value.trim()
      : completionStatusCell.textContent.trim();
    const match = statusText.match(/^(\d+)\s*\/\s*(\d+)$/);

    if (!match) {
      completionRateCell.textContent = "--";
      return;
    }

    const completedCount = Number.parseInt(match[1], 10);
    const totalCount = Number.parseInt(match[2], 10);

    if (!Number.isFinite(completedCount) || !Number.isFinite(totalCount) || totalCount <= 0) {
      completionRateCell.textContent = "--";
      return;
    }

    const completionRate = (completedCount / totalCount) * 100;
    completionRateCell.textContent = `${completionRate.toFixed(2)}%`;
  });
}

function createDivCell(content) {
  const cell = document.createElement("div");
  if (content instanceof Node) {
    cell.appendChild(content);
  } else if (typeof content === "string") {
    cell.textContent = content;
  }
  return cell;
}

let isEditMode = false;

function parseDueDateValue(value) {
  const timestamp = Date.parse(String(value).trim());
  return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
}

function getContainer() {
  return document.querySelector(".container");
}

function getRealAssignmentRows() {
  return Array.from(document.querySelectorAll(".assignment-row")).filter(
    (row) => !row.classList.contains("add-assessment-row")
  );
}

function getAddRow() {
  return document.querySelector(".add-assessment-row");
}

function getDueDateTextFromRow(row) {
  const dueDateCell = row.querySelectorAll(":scope > div")[2];
  if (!dueDateCell) {
    return "";
  }

  const input = dueDateCell.querySelector("input");
  return input ? input.value : dueDateCell.textContent;
}

function renderAddPlaceholderRow(row) {
  row.className = "assignment-row add-assessment-row";
  row.innerHTML = "";

  const plusButton = document.createElement("button");
  plusButton.type = "button";
  plusButton.className = "add-assessment-plus";
  plusButton.dataset.action = "expand-add-row";
  plusButton.setAttribute("aria-label", "Add assessment");
  plusButton.textContent = "+";

  row.appendChild(createDivCell(plusButton));
  row.appendChild(createDivCell(""));
  row.appendChild(createDivCell(""));
  row.appendChild(createDivCell(""));
  row.appendChild(createDivCell(""));

  return row;
}

function createAddPlaceholderRow() {
  const row = document.createElement("div");
  return renderAddPlaceholderRow(row);
}

function insertAddPlaceholderRow() {
  if (getAddRow()) {
    return;
  }

  const container = getContainer();
  if (!container) {
    return;
  }

  const placeholderRow = createAddPlaceholderRow();
  const rows = getRealAssignmentRows();
  const lastRow = rows[rows.length - 1];

  if (lastRow) {
    lastRow.insertAdjacentElement("afterend", placeholderRow);
    return;
  }

  const categoriesBox = container.querySelector(".categories-box");
  if (categoriesBox) {
    categoriesBox.insertAdjacentElement("afterend", placeholderRow);
    return;
  }

  container.appendChild(placeholderRow);
}

function buildInput({ type = "text", placeholder = "", value = "" }) {
  const input = document.createElement("input");
  input.type = type;
  input.className = "assessment-input";
  input.placeholder = placeholder;
  input.value = value;
  return input;
}

function makeCellEditable(cell) {
  if (!cell || cell.querySelector("input")) {
    return;
  }

  const value = cell.textContent.trim();
  const input = buildInput({ value });
  cell.textContent = "";
  cell.appendChild(input);
}

function makeCellReadOnly(cell) {
  if (!cell) {
    return;
  }

  const input = cell.querySelector("input");
  if (!input) {
    return;
  }

  cell.textContent = input.value.trim();
}

function enterEditMode() {
  const rows = getRealAssignmentRows();
  rows.forEach((row) => {
    const cells = row.querySelectorAll(":scope > div");
    makeCellEditable(cells[0]); // Name
    makeCellEditable(cells[1]); // Weight
    makeCellEditable(cells[2]); // Due Date
  });

  isEditMode = true;
  const editBtn = document.getElementById("editCourseBtn");
  if (editBtn) {
    editBtn.textContent = "Save Course Details";
  }
}

function exitEditMode() {
  const rows = getRealAssignmentRows();
  rows.forEach((row) => {
    const cells = row.querySelectorAll(":scope > div");
    makeCellReadOnly(cells[0]);
    makeCellReadOnly(cells[1]);
    makeCellReadOnly(cells[2]);
  });

  isEditMode = false;
  const editBtn = document.getElementById("editCourseBtn");
  if (editBtn) {
    editBtn.textContent = "Edit Course Details";
  }

  calculateCompletionRate();
}

function toggleEditCourseDetails() {
  if (isEditMode) {
    exitEditMode();
    return;
  }

  enterEditMode();
}

function expandAddRow(row) {
  if (!row) {
    return;
  }

  row.innerHTML = "";
  row.classList.add("add-assessment-form");

  const nameInput = buildInput({ placeholder: "Assessment name" });
  nameInput.required = true;

  const weightInput = buildInput({ placeholder: "Weight %", value: "" });
  weightInput.inputMode = "decimal";
  weightInput.required = true;

  const dueDateInput = buildInput({ type: "date" });
  dueDateInput.required = true;

  const actions = document.createElement("div");
  actions.className = "assessment-actions";

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.dataset.action = "save-add-row";
  saveBtn.textContent = "Save";

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.dataset.action = "cancel-add-row";
  cancelBtn.textContent = "Cancel";

  actions.append(saveBtn, cancelBtn);

  row.appendChild(createDivCell(nameInput));
  row.appendChild(createDivCell(weightInput));
  row.appendChild(createDivCell(dueDateInput));
  row.appendChild(createDivCell(""));
  row.appendChild(createDivCell(actions));
}

function normalizeWeight(weightText) {
  const value = String(weightText).replace("%", "").trim();
  if (value === "") {
    return null;
  }

  const num = Number.parseFloat(value);
  if (!Number.isFinite(num) || num < 0) {
    return null;
  }

  return `${num}%`;
}

function getClassSize() {
  const assignmentRows = getRealAssignmentRows();

  for (const row of assignmentRows) {
    const cells = row.querySelectorAll(":scope > div");
    const completionStatusCell = cells[3];
    if (!completionStatusCell) {
      continue;
    }

    const match = completionStatusCell.textContent.trim().match(/^(\d+)\s*\/\s*(\d+)$/);
    if (!match) {
      continue;
    }

    const totalCount = Number.parseInt(match[2], 10);
    if (Number.isFinite(totalCount) && totalCount > 0) {
      return totalCount;
    }
  }

  return 150;
}

function saveAddRow(row) {
  if (!row) {
    return;
  }

  const inputs = row.querySelectorAll("input");
  const [nameInput, weightInput, dueDateInput] = inputs;

  if (!nameInput || !weightInput || !dueDateInput) {
    return;
  }

  const name = nameInput.value.trim();
  const weight = normalizeWeight(weightInput.value);
  const dueDate = dueDateInput.value.trim();
  const completionStatus = `0/${getClassSize()}`;

  if (!name) {
    nameInput.setCustomValidity("Enter an assessment name.");
    nameInput.reportValidity();
    return;
  }
  nameInput.setCustomValidity("");

  if (!weight) {
    weightInput.setCustomValidity("Enter a valid weight percentage.");
    weightInput.reportValidity();
    return;
  }
  weightInput.setCustomValidity("");

  if (!dueDate) {
    dueDateInput.setCustomValidity("Choose a due date.");
    dueDateInput.reportValidity();
    return;
  }
  dueDateInput.setCustomValidity("");

  const newRow = document.createElement("div");
  newRow.className = "assignment-row";
  newRow.appendChild(createDivCell(name));
  newRow.appendChild(createDivCell(weight));
  newRow.appendChild(createDivCell(dueDate));
  newRow.appendChild(createDivCell(completionStatus));
  newRow.appendChild(createDivCell(""));

  row.replaceWith(newRow);
  calculateCompletionRate();
}

function cancelAddRow(row) {
  if (!row) {
    return;
  }

  row.remove();
}

function sortAdminAssignmentsByDueDate() {
  const container = getContainer();
  if (!container) {
    return;
  }

  const rows = getRealAssignmentRows();
  if (rows.length === 0) {
    return;
  }

  rows.sort((a, b) => {
    const aDate = parseDueDateValue(getDueDateTextFromRow(a));
    const bDate = parseDueDateValue(getDueDateTextFromRow(b));
    return aDate - bDate;
  });

  const addRow = getAddRow();
  rows.forEach((row) => container.appendChild(row));

  if (addRow) {
    container.appendChild(addRow);
  }
}

function handleAddRowClicks(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const actionEl = target.closest("[data-action]");
  if (!(actionEl instanceof HTMLElement)) {
    return;
  }

  const row = actionEl.closest(".add-assessment-row");
  if (!row) {
    return;
  }

  const action = actionEl.dataset.action;
  if (action === "expand-add-row") {
    expandAddRow(row);
    return;
  }

  if (action === "save-add-row") {
    saveAddRow(row);
    return;
  }

  if (action === "cancel-add-row") {
    cancelAddRow(row);
  }
}

function handleAdminRowInput(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  const row = target.closest(".assignment-row");
  if (!row || row.classList.contains("add-assessment-row")) {
    return;
  }

  const cell = target.closest("div");
  if (!cell) {
    return;
  }

  const cells = row.querySelectorAll(":scope > div");
  if (cell === cells[3]) {
    calculateCompletionRate();
  }
}

function initializeAddAssessment() {
  const addAssignmentBtn = document.getElementById("addAssignmentBtn");
  const editCourseBtn = document.getElementById("editCourseBtn");
  const sortDueDateBtn = document.getElementById("sortDueDateBtn");
  const container = getContainer();

  if (addAssignmentBtn) {
    addAssignmentBtn.addEventListener("click", insertAddPlaceholderRow);
  }

  if (container) {
    container.addEventListener("click", handleAddRowClicks);
    container.addEventListener("input", handleAdminRowInput);
  }

  if (editCourseBtn) {
    editCourseBtn.addEventListener("click", toggleEditCourseDetails);
  }

  if (sortDueDateBtn) {
    sortDueDateBtn.addEventListener("click", sortAdminAssignmentsByDueDate);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  calculateCompletionRate();
  initializeAddAssessment();
});

window.calculateCompletionRate = calculateCompletionRate;
window.toggleEditCourseDetails = toggleEditCourseDetails;
window.sortAdminAssignmentsByDueDate = sortAdminAssignmentsByDueDate;
