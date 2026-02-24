const courseGrades = [
  { code: "SOEN 287", name: "Web Development", grade: 88 },
  { code: "SOEN 228", name: "System Hardware", grade: 81 },
  { code: "COMP 352", name: "Data Structures and Algorithms", grade: 92 }
];

function renderCourseGradeBars() {
  const barChartContainer = document.getElementById("barChartContainer");
  if (!barChartContainer) {
    return;
  }

  const rowsMarkup = courseGrades
    .map(({ code, name, grade }) => {
      const safeGrade = Math.max(0, Math.min(100, grade));

      return `
        <div class="grade-bar-column">
          <span class="grade-value">${safeGrade}%</span>
          <div class="bar-track-vertical" role="img" aria-label="${code} ${name} grade ${safeGrade} percent">
            <div class="bar-fill-vertical" style="height: ${safeGrade}%;"></div>
          </div>
          <span class="course-name" title="${code} - ${name}">${code}</span>
        </div>
      `;
    })
    .join("");

  barChartContainer.innerHTML = rowsMarkup;
}

const menuButton = document.getElementById("menu-button");
const offScreenMenu = document.getElementById("off-screen-menu");
const menuCloseButton = document.getElementById("menu-close-button");

if (menuButton && offScreenMenu) {
  menuButton.addEventListener("click", () => {
    const isOpen = offScreenMenu.classList.toggle("is-open");
    menuButton.setAttribute("aria-expanded", String(isOpen));
  });
}

if (menuCloseButton && menuButton && offScreenMenu) {
  menuCloseButton.addEventListener("click", () => {
    offScreenMenu.classList.remove("is-open");
    menuButton.setAttribute("aria-expanded", "false");
  });
}

renderCourseGradeBars();
