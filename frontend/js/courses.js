class Course {
  constructor(code, name, term, description) {
    this.code = code;
    this.name = name;
    this.term = term;
    this.description = description;
  }
}

const storage = "sccCourses";
let courses = [];

const addCourseBtn = document.getElementById("addCourseBtn");
const addCourseModal = document.getElementById("addCourseModal");
const addCourseForm = document.getElementById("addCourseForm");
const cancelAddCourseBtn = document.getElementById("cancelAddCourseBtn");
const coursesGrid = document.getElementById("coursesGrid");

//saves the courses to local storage
function saveCourse() {
  localStorage.setItem(storage, JSON.stringify(courses));
  console.log("Courses saved:", courses);
}

//loads the courses from local storage
function loadCourses() {
  const raw = localStorage.getItem(storage);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

//renders all courses from local storage on page load
function renderCourses() {
  coursesGrid.innerHTML = "";
  courses.forEach(renderCourse);
}

function openAddCourseModal() {
  addCourseModal.classList.add("is-open");
  addCourseModal.setAttribute("aria-hidden", "false");
}

function closeAddCourseModal() {
  addCourseModal.classList.remove("is-open");
  addCourseModal.setAttribute("aria-hidden", "true");
  addCourseForm.reset();
}

function renderCourse(course) {
  const card = document.createElement("article");
  card.className = "card course-card";

  const title = document.createElement("h2");
  title.className = "card-title";
  title.textContent = `${course.code} - ${course.name}`;

  const term = document.createElement("p");
  term.className = "course-meta";
  term.textContent = course.term;

  const description = document.createElement("p");
  description.className = "card-subtitle";
  description.textContent = course.description;

  const actions = document.createElement("div");
  actions.className = "course-actions";

  const openLink = document.createElement("a");
  openLink.className = "btn btn-outline";
  openLink.href = "./course-details.html";
  openLink.textContent = "Open";

  const dropBtn = document.createElement("button");
  dropBtn.className = "btn btn-danger";
  dropBtn.type = "button";
  dropBtn.textContent = "Drop";
  dropBtn.addEventListener("click", () => {
    const index = courses.findIndex(
      (savedCourse) =>
        savedCourse.code === course.code &&
        savedCourse.name === course.name &&
        savedCourse.term === course.term,
    );

    if (index > -1) {
      courses.splice(index, 1);
      saveCourse();
    }
    card.remove();
  });

  actions.append(openLink, dropBtn);
  card.append(title, term, description, actions);
  coursesGrid.appendChild(card);
}

addCourseBtn.addEventListener("click", openAddCourseModal);
cancelAddCourseBtn.addEventListener("click", closeAddCourseModal);

addCourseModal.addEventListener("click", (event) => {
  if (event.target === addCourseModal) {
    closeAddCourseModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && addCourseModal.classList.contains("is-open")) {
    closeAddCourseModal();
  }
});

addCourseForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(addCourseForm);
  const course = new Course(
    formData.get("courseCode").trim(),
    formData.get("courseName").trim(),
    formData.get("courseTerm").trim(),
    formData.get("courseDescription").trim(),
  );
  const alreadyExists = courses.some(
    (c) =>
      c.code.toLowerCase() === course.code.toLowerCase() &&
      c.term === course.term,
  );

  if (alreadyExists) {
    alert("Course already exists.");
    return;
  }

  courses.push(course);
  saveCourse();
  renderCourse(course);
  closeAddCourseModal();
  console.log("Course added:", course);
});

courses = loadCourses();
renderCourses();
