const ADMIN_COURSES_STORAGE_KEY = "adminCoursesState";

const createCourseButton = document.getElementById("create-course-btn");
const createCourseModal = document.getElementById("create-course-modal");
const closeCreateCourseModal = document.getElementById(
  "close-create-course-modal",
);
const createCourseForm = document.getElementById("create-course-form");
const coursesList = document.querySelector(".courses-list");
const initialCourseCards = document.querySelectorAll(".course-card");

function createCourseId() {
  return `course-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function parseCourseTitle(title = "") {
  const separatorIndex = title.indexOf(" - ");
  if (separatorIndex === -1) {
    return {
      code: title.trim(),
      name: "",
    };
  }

  return {
    code: title.slice(0, separatorIndex).trim(),
    name: title.slice(separatorIndex + 3).trim(),
  };
}

function buildCourseFromCard(card) {
  const title = card.querySelector("h3")?.textContent?.trim() || "";
  const { code, name } = parseCourseTitle(title);
  const details = Array.from(card.querySelectorAll("p"));

  return {
    id: createCourseId(),
    code,
    name,
    professor:
      details[0]?.textContent?.replace("Prof:", "").trim() || "",
    section:
      details[1]?.textContent?.replace("Section:", "").trim() || "",
    term:
      details[2]?.textContent?.replace("Term:", "").trim() || "",
    credits:
      details[3]?.textContent?.replace("Credits:", "").trim() || "",
  };
}

function getDefaultCourseState() {
  return {
    active: Array.from(initialCourseCards, buildCourseFromCard),
    disabled: [],
  };
}

function loadCourseState() {
  const savedState = window.localStorage.getItem(ADMIN_COURSES_STORAGE_KEY);

  if (!savedState) {
    const defaultState = getDefaultCourseState();
    saveCourseState(defaultState);
    return defaultState;
  }

  try {
    const parsedState = JSON.parse(savedState);
    return {
      active: Array.isArray(parsedState.active) ? parsedState.active : [],
      disabled: Array.isArray(parsedState.disabled) ? parsedState.disabled : [],
    };
  } catch (error) {
    console.error("Unable to parse admin course state:", error);
    const fallbackState = getDefaultCourseState();
    saveCourseState(fallbackState);
    return fallbackState;
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

function renderActiveCourses() {
  if (!coursesList) {
    return;
  }

  const state = loadCourseState();
  coursesList.innerHTML = "";

  state.active.forEach((course) => {
    const card = createCourseCard(course);
    addCourseActions(card);
    addCourseCardClickHandler(card);
    coursesList.appendChild(card);
  });
}

function disableCourse(courseId) {
  const state = loadCourseState();
  const courseIndex = state.active.findIndex((course) => course.id === courseId);

  if (courseIndex === -1) {
    return;
  }

  const [course] = state.active.splice(courseIndex, 1);
  state.disabled.unshift(course);
  saveCourseState(state);
  renderActiveCourses();
}

function deleteCourse(courseId) {
  const state = loadCourseState();
  state.active = state.active.filter((course) => course.id !== courseId);
  state.disabled = state.disabled.filter((course) => course.id !== courseId);
  saveCourseState(state);
  renderActiveCourses();
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

  const disableButton = document.createElement("button");
  disableButton.className = "course-disable-btn";
  disableButton.type = "button";
  disableButton.textContent = "Disable course";

  const deleteButton = document.createElement("button");
  deleteButton.className = "course-delete-btn";
  deleteButton.type = "button";
  deleteButton.textContent = "Delete course";

  actionsMenu.append(disableButton, deleteButton);
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

  disableButton.addEventListener("click", (event) => {
    event.stopPropagation();
    disableCourse(courseId);
  });

  deleteButton.addEventListener("click", (event) => {
    event.stopPropagation();
    deleteCourse(courseId);
  });
}

function addCourseCardClickHandler(card) {
  if (!card) {
    return;
  }

  card.addEventListener("click", () => {
    window.location.href = "courseAdmin.html";
  });
}

document.addEventListener("click", closeAllCourseMenus);

function closeModal() {
  if (!createCourseModal) {
    return;
  }

  createCourseModal.classList.remove("is-open");
  document.body.style.overflow = "auto";
}

if (createCourseButton && createCourseModal) {
  createCourseButton.onclick = function () {
    createCourseModal.classList.add("is-open");
    document.body.style.overflow = "hidden";
  };
}

if (closeCreateCourseModal && createCourseModal) {
  closeCreateCourseModal.onclick = closeModal;

  createCourseModal.addEventListener("click", (event) => {
    if (event.target === createCourseModal) {
      closeModal();
    }
  });
}

if (createCourseForm && coursesList) {
  createCourseForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const courseName = document.getElementById("course-name")?.value.trim();
    const courseCode = document.getElementById("course-code")?.value.trim();
    const section = document
      .getElementById("section")
      ?.value.trim()
      .toUpperCase();
    const term = document.getElementById("term")?.value.trim();
    const professor = document.getElementById("professor")?.value.trim();
    const credits = document.getElementById("course-credits")?.value.trim();

    if (credits && !/^\d+$/.test(credits)) {
      alert("Credits must be a number.");
      document.getElementById("course-credits").value = "";
      return;
    }

    if (
      !courseName ||
      !courseCode ||
      !section ||
      !term ||
      !professor ||
      !credits
    ) {
      return;
    }

    const state = loadCourseState();
    state.active.unshift({
      id: createCourseId(),
      code: courseCode,
      name: courseName,
      professor,
      section,
      term,
      credits,
    });
    saveCourseState(state);

    createCourseForm.reset();
    closeModal();
    renderActiveCourses();
  });
}

renderActiveCourses();
