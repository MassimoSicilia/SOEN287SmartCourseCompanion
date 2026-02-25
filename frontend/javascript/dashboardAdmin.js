const createCourseButton = document.getElementById("create-course-btn");
if (createCourseButton) {
  createCourseButton.onclick = function () {
    window.location.href = "addCourse.html";
  };
}
