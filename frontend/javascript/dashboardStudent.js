const addCourseButton = document.getElementById("add-course-btn");
const addCourseModal = document.getElementById("addCourseModal");
const closeAddCourseModal = document.getElementById("closeAddCourseModal");
const courseCards = document.querySelectorAll(".course-card");

if (courseCards) {
  courseCards.forEach((card) => {
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
  });
}

document.addEventListener("click", () => {
  document.querySelectorAll(".course-actions-menu.is-open").forEach((menu) => {
    menu.classList.remove("is-open");
  });
});

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
    document.body.style.overflow = "auto";
  };

  addCourseModal.addEventListener("click", (event) => {
    if (event.target === addCourseModal) {
      addCourseModal.classList.remove("is-open");
      document.body.style.overflow = "auto";
    }
  });
}
