const createCourseButton = document.getElementById("create-course-btn");
const createCourseModal = document.getElementById("create-course-modal");
const closeCreateCourseModal = document.getElementById(
  "close-create-course-modal",
);
const createCourseForm = document.getElementById("create-course-form");
const coursesList = document.querySelector(".courses-list");
const courseCards = document.querySelectorAll(".course-card");

function closeAllCourseMenus() {
  document.querySelectorAll(".course-actions-menu.is-open").forEach((menu) => {
    menu.classList.remove("is-open");
  });
}

function addCourseActions(card) {
  if (!card || card.querySelector(".course-actions-btn")) {
    return;
  }

  const actionsButton = document.createElement("button");
  actionsButton.className = "course-actions-btn";
  actionsButton.type = "button";
  actionsButton.setAttribute("aria-label", "Course actions");
  actionsButton.innerHTML = "<span></span><span></span><span></span>";

  const actionsMenu = document.createElement("div");
  actionsMenu.className = "course-actions-menu";

  const deleteButton = document.createElement("button");
  deleteButton.className = "course-delete-btn";
  deleteButton.type = "button";
  deleteButton.textContent = "Delete course";

  actionsMenu.appendChild(deleteButton);
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

  deleteButton.addEventListener("click", (event) => {
    event.stopPropagation();
    card.remove();
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

if (courseCards) {
  courseCards.forEach((card) => {
    addCourseActions(card);
    addCourseCardClickHandler(card);
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

    //reject if credits are not nums
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

    const newCard = document.createElement("div");
    newCard.className = "course-card";
    newCard.innerHTML = `
      <h3>${courseCode} - ${courseName}</h3>
      <p><span class="course-label">Prof:</span> ${professor}</p>
      <p><span class="course-label">Section:</span> ${section}</p>
      <p><span class="course-label">Term:</span> ${term}</p>
      <p><span class="course-label">Credits:</span> ${credits}</p>
    `;

    addCourseActions(newCard);
    addCourseCardClickHandler(newCard);
    coursesList.prepend(newCard);
    createCourseForm.reset();
    closeModal();
  });
}
