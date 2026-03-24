const courseAverages = [
  { code: "SOEN 287", name: "Web Development", average: 78 },
  { code: "SOEN 228", name: "System Hardware", average: 72 },
  { code: "COMP 352", name: "Data Structures and Algorithms", average: 84 },
  { code: "SOEN 341", name: "Software Process", average: 76 },
];

function renderCourseAverageBars() {
  const barChartContainer = document.getElementById("barChartContainer");
  if (!barChartContainer) {
    return;
  }

  const rowsMarkup = courseAverages
    .map(({ code, name, average }) => {
      const safeAverage = Math.max(0, Math.min(100, average));

      return `
        <div class="grade-bar-column">
          <span class="grade-value">${safeAverage}%</span>
          <div class="bar-track-vertical" role="img" aria-label="${code} ${name} class average ${safeAverage} percent">
            <div class="bar-fill-vertical" style="height: ${safeAverage}%;"></div>
          </div>
          <span class="course-name" title="${code} - ${name}">${code}</span>
        </div>
      `;
    })
    .join("");

  barChartContainer.innerHTML = rowsMarkup;
}

renderCourseAverageBars();
