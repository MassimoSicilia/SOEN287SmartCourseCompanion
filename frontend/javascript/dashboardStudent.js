const addCourseButton = document.getElementById("add-course-btn");
const addCourseModal = document.getElementById("addCourseModal");
const closeAddCourseModal = document.getElementById("closeAddCourseModal");
const addCourseForm = document.getElementById("addCourseForm");
const coursesList = document.querySelector(".courses-list");
const courseCards = document.querySelectorAll(".course-card");

function closeAllCourseMenus() {
  document.querySelectorAll(".course-actions-menu.is-open").forEach((menu) => {
    menu.classList.remove("is-open");
  });
}

function addCourseCardHandlers(card) {
  if (!card || card.dataset.initialized === "true") {
    return;
  }

  const actionsButton = card.querySelector(".course-actions-btn");
  const actionsMenu = card.querySelector(".course-actions-menu");
  const deleteButton = card.querySelector(".course-delete-btn");

  if (actionsButton && actionsMenu) {
    actionsButton.addEventListener("click", (event) => {
      event.stopPropagation();

      document.querySelectorAll(".course-actions-menu.is-open").forEach((menu) => {
        if (menu !== actionsMenu) {
          menu.classList.remove("is-open");
        }
      });

      actionsMenu.classList.toggle("is-open");
    });
  }

  if (deleteButton) {
    deleteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      card.remove();
    });
  }

  card.addEventListener("click", () => {
    window.location.href = "courseStudent.html";
  });

  card.dataset.initialized = "true";
}

function closeModal() {
  if (!addCourseModal) {
    return;
  }

  addCourseModal.classList.remove("is-open");
  document.body.style.overflow = "auto";
}

if (courseCards) {
  courseCards.forEach((card) => {
    addCourseCardHandlers(card);
  });
}

document.addEventListener("click", closeAllCourseMenus);

if (addCourseButton) {
  addCourseButton.onclick = function () {
    if (addCourseModal) {
      addCourseModal.classList.add("is-open");
      document.body.style.overflow = "hidden";
      return;
    }
  };
}

if (closeAddCourseModal && addCourseModal) {
  closeAddCourseModal.onclick = closeModal;

  addCourseModal.addEventListener("click", (event) => {
    if (event.target === addCourseModal) {
      closeModal();
    }
  });
}

if (addCourseForm && coursesList) {
  addCourseForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const courseCode = document.getElementById("courseCode")?.value.trim();
    const courseName = document.getElementById("courseName")?.value.trim();
    const professor = document.getElementById("professor")?.value.trim();
    const section = document.getElementById("section")?.value.trim().toUpperCase();
    const term = document.getElementById("term")?.value.trim();

    if (!courseCode || !courseName || !professor || !section || !term) {
      return;
    }

    const newCard = document.createElement("div");
    newCard.className = "course-card";
    newCard.innerHTML = `
      <button class="course-actions-btn" type="button" aria-label="Course actions">
        <span></span>
        <span></span>
        <span></span>
      </button>
      <div class="course-actions-menu">
        <button class="course-delete-btn" type="button">Delete course</button>
      </div>
      <h3>${courseCode} - ${courseName}</h3>
      <p><span class="course-label">Prof:</span> ${professor}</p>
      <p><span class="course-label">Section:</span> ${section}</p>
      <p><span class="course-label">Term:</span> ${term}</p>
    `;

    addCourseCardHandlers(newCard);
    coursesList.prepend(newCard);
    addCourseForm.reset();
    closeModal();
  });
}
