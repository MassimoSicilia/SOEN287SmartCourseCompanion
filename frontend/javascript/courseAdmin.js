function calculateCompletionRate() {
  const assignmentRows = document.querySelectorAll(".assignment-row");

  assignmentRows.forEach((row) => {
    const cells = row.querySelectorAll(":scope > div");
    const completionStatusCell = cells[3];
    const completionRateCell = cells[4];

    if (!completionStatusCell || !completionRateCell) {
      return;
    }

    const statusText = completionStatusCell.textContent.trim();
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

document.addEventListener("DOMContentLoaded", calculateCompletionRate);
window.calculateCompletionRate = calculateCompletionRate;

