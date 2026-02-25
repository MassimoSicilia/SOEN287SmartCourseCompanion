const addCourseButton = document.getElementById("add-course-btn");
const addCourseModal = document.getElementById("addCourseModal");
const closeAddCourseModal = document.getElementById("closeAddCourseModal");
const courseCards = document.querySelectorAll(".course-card");

if (courseCards) {
  courseCards.forEach((card) => {
    card.addEventListener("click", () => {
      window.location.href = "courseStudent.html";
    });
  });
}

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
  closeAddCourseModal.onclick = function () {
    addCourseModal.classList.remove("is-open");
  };

  addCourseModal.addEventListener("click", (event) => {
    if (event.target === addCourseModal) {
      addCourseModal.classList.remove("is-open");
    }
  });
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
  if (addCourseButton) {
    addCourseButton.onclick = function () {
      window.location.href = "addCourse.html";
    };
  }
}
