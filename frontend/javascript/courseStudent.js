const inProgressBtn = document.getElementById("inProgressBtn");
const completedBtn = document.getElementById("completedBtn");
const inProgressContent = document.getElementById("inProgressContent");
const completedContent = document.getElementById("completedContent");

function createCell(text) {
  const cell = document.createElement("div");
  cell.textContent = text;
  return cell;
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
    createCell(grade),
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
}

setActiveTab(false);
