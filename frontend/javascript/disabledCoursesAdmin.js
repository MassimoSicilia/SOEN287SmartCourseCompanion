const ADMIN_COURSES_STORAGE_KEY = "adminCoursesState";
const disabledCoursesList = document.querySelector(".courses-list");

function loadCourseState() {
  const savedState = window.localStorage.getItem(ADMIN_COURSES_STORAGE_KEY);

  if (!savedState) {
    return {
      active: [],
      disabled: [],
    };
  }

  try {
    const parsedState = JSON.parse(savedState);
    return {
      active: Array.isArray(parsedState.active) ? parsedState.active : [],
      disabled: Array.isArray(parsedState.disabled) ? parsedState.disabled : [],
    };
  } catch (error) {
    console.error("Unable to parse admin course state:", error);
    return {
      active: [],
      disabled: [],
    };
  }
}

function saveCourseState(state) {
  window.localStorage.setItem(
    ADMIN_COURSES_STORAGE_KEY,
    JSON.stringify(state),
  );
}

function closeAllCourseMenus() {
  document.querySelectorAll(".course-actions-menu.is-open").forEach((menu) => {
    menu.classList.remove("is-open");
  });
}

function createCourseCard(course) {
  const card = document.createElement("div");
  card.className = "course-card";
  card.dataset.courseId = course.id;
  card.innerHTML = `
    <h3>${course.code} - ${course.name}</h3>
    <p><span class="course-label">Prof:</span> ${course.professor}</p>
    <p><span class="course-label">Section:</span> ${course.section}</p>
    <p><span class="course-label">Term:</span> ${course.term}</p>
    <p><span class="course-label">Credits:</span> ${course.credits}</p>
  `;

  return card;
}

function enableCourse(courseId) {
  const state = loadCourseState();
  const courseIndex = state.disabled.findIndex((course) => course.id === courseId);

  if (courseIndex === -1) {
    return;
  }

  const [course] = state.disabled.splice(courseIndex, 1);
  state.active.unshift(course);
  saveCourseState(state);
  renderDisabledCourses();
}

function addCourseActions(card) {
  if (!card || card.querySelector(".course-actions-btn")) {
    return;
  }

  const courseId = card.dataset.courseId;
  const actionsButton = document.createElement("button");
  actionsButton.className = "course-actions-btn";
  actionsButton.type = "button";
  actionsButton.setAttribute("aria-label", "Course actions");
  actionsButton.innerHTML = "<span></span><span></span><span></span>";

  const actionsMenu = document.createElement("div");
  actionsMenu.className = "course-actions-menu";

  const enableButton = document.createElement("button");
  enableButton.className = "course-enable-btn";
  enableButton.type = "button";
  enableButton.textContent = "Enable course";

  actionsMenu.appendChild(enableButton);
  card.insertBefore(actionsButton, card.firstChild);
  card.insertBefore(actionsMenu, card.firstChild.nextSibling);

  actionsButton.addEventListener("click", (event) => {
    event.stopPropagation();

    document.querySelectorAll(".course-actions-menu.is-open").forEach((menu) => {
      if (menu !== actionsMenu) {
        menu.classList.remove("is-open");
      }
    });

    actionsMenu.classList.toggle("is-open");
  });

  enableButton.addEventListener("click", (event) => {
    event.stopPropagation();
    enableCourse(courseId);
  });
}

function renderDisabledCourses() {
  if (!disabledCoursesList) {
    return;
  }

  const state = loadCourseState();
  disabledCoursesList.innerHTML = "";

  state.disabled.forEach((course) => {
    const card = createCourseCard(course);
    addCourseActions(card);
    disabledCoursesList.appendChild(card);
  });
}

document.addEventListener("click", closeAllCourseMenus);

renderDisabledCourses();
