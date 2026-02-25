function parsePercent(text) {
  const value = Number.parseFloat(String(text).replace("%", "").trim());
  return Number.isFinite(value) ? value : null;
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

document.addEventListener("DOMContentLoaded", () => {
  calculateTotalWeight();
  calculateAverage();
});

window.calculateAverage = calculateAverage;
window.calculateTotalWeight = calculateTotalWeight;
