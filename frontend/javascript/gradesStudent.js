function parsePercent(text) {
  const value = Number.parseFloat(String(text).replace("%", "").trim());
  return Number.isFinite(value) ? value : null;
}

const EXPECTED_ASSESSMENT_ROWS = 6;

function createSpacerRow() {
  const row = document.createElement("li");
  row.className = "empty-assessment-row";
  row.setAttribute("aria-hidden", "true");
  row.innerHTML = `
    <span class="col-assessment-name">&nbsp;</span>
    <span>&nbsp;</span>
    <span>&nbsp;</span>
  `;
  return row;
}

function normalizeCourseCardRows() {
  const courseCards = document.querySelectorAll(".course-row-box");

  courseCards.forEach((card) => {
    const list = card.querySelector(".category-list");
    const summaryRow = list?.querySelector(".course-summary-row");
    if (!list || !summaryRow) {
      return;
    }

    list.querySelectorAll(".empty-assessment-row").forEach((row) => row.remove());

    const assessmentRows = Array.from(list.querySelectorAll(":scope > li")).filter(
      (row) =>
        row !== summaryRow &&
        !row.classList.contains("empty-assessment-row") &&
        row.querySelector(".col-grade-value") &&
        row.querySelector(".col-weight-value")
    );

    const missingRows = Math.max(0, EXPECTED_ASSESSMENT_ROWS - assessmentRows.length);
    for (let i = 0; i < missingRows; i++) {
      list.insertBefore(createSpacerRow(), summaryRow);
    }
  });
}

function calculateTotalWeight() {
  const courseCards = document.querySelectorAll(".course-row-box");

  courseCards.forEach((card) => {
    let totalWeight = 0;

    const rows = card.querySelectorAll(".category-list li");
    rows.forEach((row) => {
      const weightEl = row.querySelector(".col-weight-value");
      if (!weightEl) {
        return;
      }

      const weight = parsePercent(weightEl.textContent);
      if (weight === null) {
        return;
      }

      totalWeight += weight;
    });

    const totalWeightEl = card.querySelector(".course-total-weight-value");
    if (totalWeightEl) {
      totalWeightEl.textContent = `${totalWeight.toFixed(0)}%`;
    }
  });
}

function calculateAverage() {
  const courseCards = document.querySelectorAll(".course-row-box");

  courseCards.forEach((card) => {
    let weightedSum = 0;
    let totalWeight = 0;

    const rows = card.querySelectorAll(".category-list li");
    rows.forEach((row) => {
      const gradeEl = row.querySelector(".col-grade-value");
      const weightEl = row.querySelector(".col-weight-value");

      if (!gradeEl || !weightEl) {
        return;
      }

      const grade = parsePercent(gradeEl.textContent);
      const weight = parsePercent(weightEl.textContent);

      if (grade === null || weight === null) {
        return;
      }

      weightedSum += grade * (weight / 100);
      totalWeight += weight;
    });

    let averageEl = card.querySelector(".course-average-value");
    if (!averageEl) {
      const averageRow = card.querySelector(".category-list li:last-child");
      if (!averageRow) {
        return;
      }

      averageEl = document.createElement("span");
      averageEl.className = "course-average-value";
      averageRow.appendChild(averageEl);
    }

    if (totalWeight === 0) {
      averageEl.textContent = " --";
      return;
    }

    const average = weightedSum / (totalWeight / 100);
    averageEl.textContent = ` ${average.toFixed(2)}%`;
  });
}

function refreshGradesCards() {
  normalizeCourseCardRows();
  calculateTotalWeight();
  calculateAverage();
}

document.addEventListener("DOMContentLoaded", () => {
  refreshGradesCards();
});

window.calculateAverage = calculateAverage;
window.calculateTotalWeight = calculateTotalWeight;
window.normalizeCourseCardRows = normalizeCourseCardRows;
window.refreshGradesCards = refreshGradesCards;
