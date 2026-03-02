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
    document.body.style.overflow = "auto";
  };

  addCourseModal.addEventListener("click", (event) => {
    if (event.target === addCourseModal) {
      addCourseModal.classList.remove("is-open");
      document.body.style.overflow = "auto";
    }
  });
}
