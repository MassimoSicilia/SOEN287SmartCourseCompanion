const createCourseButton = document.getElementById("create-course-btn");
const createCourseModal = document.getElementById("create-course-modal");
const closeCreateCourseModal = document.getElementById(
  "close-create-course-modal",
);
const createCourseForm = document.getElementById("create-course-form");
const coursesList = document.querySelector(".courses-list");
const courseCards = document.querySelectorAll(".course-card");

function addCourseCardClickHandler(card) {
  if (!card) {
    return;
  }

  card.addEventListener("click", () => {
    window.location.href = "courseAdmin.html";
  });
}

if (courseCards) {
  courseCards.forEach((card) => {
    addCourseCardClickHandler(card);
  });
}

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

    if (!courseName || !courseCode || !section || !term || !professor) {
      return;
    }

    const newCard = document.createElement("div");
    newCard.className = "course-card";
    newCard.innerHTML = `
      <h3>${courseCode} - ${courseName}</h3>
      <p><span class="course-label">Prof:</span> ${professor}</p>
      <p><span class="course-label">Section:</span> ${section}</p>
      <p><span class="course-label">Term:</span> ${term}</p>
    `;

    addCourseCardClickHandler(newCard);
    coursesList.prepend(newCard);
    createCourseForm.reset();
    closeModal();
  });
}
