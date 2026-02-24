const inProgressBtn = document.getElementById("inProgressBtn");
const completedBtn = document.getElementById("completedBtn");
const inProgressContent = document.getElementById("inProgressContent");
const completedContent = document.getElementById("completedContent");

function showTab(tabName) {
  const showInProgress = tabName === "inProgress";

  inProgressContent.style.display = showInProgress ? "block" : "none";
  completedContent.style.display = showInProgress ? "none" : "block";

  inProgressBtn.classList.toggle("active", showInProgress);
  completedBtn.classList.toggle("active", !showInProgress);
}

function setRowLocked(row, isLocked) {
  const gradeInput = row.querySelector('input[type="text"], input[type="number"]');
  const statusSelect = row.querySelector("select");

  if (gradeInput) {
    gradeInput.readOnly = isLocked;
    gradeInput.disabled = isLocked;
  }

  if (statusSelect) {
    statusSelect.disabled = isLocked;
  }
}

function finalizeSubmittedRow(row) {
  if (row.dataset.finalized === "true") return;

  const gradeInput = row.querySelector('input[type="text"], input[type="number"]');
  const statusSelect = row.querySelector("select");

  if (gradeInput) {
    const gradeText = document.createElement("div");
    gradeText.textContent = gradeInput.value.trim();
    gradeInput.replaceWith(gradeText);
  }

  if (statusSelect) {
    const statusText = document.createElement("div");
    statusText.textContent = "Submitted";
    statusSelect.replaceWith(statusText);
  }

  row.dataset.finalized = "true";
}

function moveAssignmentRow(selectEl) {
  const row = selectEl.closest(".assignment-row");
  if (!row) return;

  const status = selectEl.value.trim().toLowerCase();
  const isSubmitted = status === "submitted";
  const target = isSubmitted ? completedContent : inProgressContent;

  if (isSubmitted) {
    finalizeSubmittedRow(row);
  }

  target.appendChild(row);
  setRowLocked(row, isSubmitted);
}

function setupStatusDropdowns() {
  const statusSelects = document.querySelectorAll(".assignment-row select");

  statusSelects.forEach((selectEl) => {
    selectEl.dataset.previousValue = selectEl.value;

    selectEl.addEventListener("change", () => {
      const row = selectEl.closest(".assignment-row");
      const gradeInput = row?.querySelector('input[type="text"], input[type="number"]');
      const isSubmitting = selectEl.value.trim().toLowerCase() === "submitted";
      const gradeIsEmpty = !gradeInput || gradeInput.value.trim() === "";

      if (isSubmitting && gradeIsEmpty) {
        alert("Please enter a grade before submitting this assessment.");
        selectEl.value = selectEl.dataset.previousValue || "";
        return;
      }

      moveAssignmentRow(selectEl);
      selectEl.dataset.previousValue = selectEl.value;
    });

    moveAssignmentRow(selectEl);
    selectEl.dataset.previousValue = selectEl.value;
  });
}

inProgressBtn.addEventListener("click", () => showTab("inProgress"));
completedBtn.addEventListener("click", () => showTab("completed"));

setupStatusDropdowns();
showTab("inProgress"); 
