const supabaseClient = window.supabaseClient;
const courseDataStore = window.CourseDataStore;
const addCourseButton = document.getElementById("add-course-btn");
const addCourseModal = document.getElementById("addCourseModal");
const closeAddCourseModal = document.getElementById("closeAddCourseModal");
const addCourseForm = document.getElementById("addCourseForm");
const coursesList = document.getElementById("courses-list");
const courseOfferingSelect = document.getElementById("courseOfferingSelect");
const selectedCoursePreview = document.getElementById("selected-course-preview");
const coursesStatusMessage = document.getElementById("courses-status-message");

const dashboardState = {
  currentUser: null,
  allCourses: [],
  enrolledCourses: [],
};

function closeAllCourseMenus() {
  document.querySelectorAll(".course-actions-menu.is-open").forEach((menu) => {
    menu.classList.remove("is-open");
  });
}

function setStatusMessage(message = "", isError = false) {
  if (!coursesStatusMessage) {
    return;
  }

  coursesStatusMessage.textContent = message;
  coursesStatusMessage.classList.toggle("is-error", Boolean(isError));
}

function setSelectedCourse(course) {
  if (!course) {
    sessionStorage.removeItem("selectedStudentCourse");
    return;
  }

  sessionStorage.setItem("selectedStudentCourse", JSON.stringify(course));
}

function closeModal() {
  if (!addCourseModal) {
    return;
  }

  addCourseModal.classList.remove("is-open");
  document.body.style.overflow = "auto";
}

function openModal() {
  if (!addCourseModal) {
    return;
  }

  addCourseModal.classList.add("is-open");
  document.body.style.overflow = "hidden";
}

function getDisplayTerm(course) {
  return course.term || "Unknown term";
}

function getDisplayCredits(course) {
  return course.credits ? `${course.credits} credits` : "Credits unavailable";
}

function buildCourseLabel(course) {
  return `${course.courseCode} - ${course.courseName} (${course.section})`;
}

function getAvailableCoursesForEnrollment() {
  const enrolledIds = new Set(
    dashboardState.enrolledCourses.map((course) => course.courseOfferingId),
  );

  return dashboardState.allCourses.filter(
    (course) => course.isEnabled && !enrolledIds.has(course.courseOfferingId),
  );
}

function updateSelectedCoursePreview() {
  if (!selectedCoursePreview) {
    return;
  }

  const selectedCourseId = courseOfferingSelect?.value;
  const availableCourse = getAvailableCoursesForEnrollment().find(
    (course) => course.courseOfferingId === selectedCourseId,
  );

  if (!availableCourse) {
    selectedCoursePreview.textContent = "Select a course to see its details.";
    return;
  }

  selectedCoursePreview.textContent =
    `Professor: ${availableCourse.instructorName} | ` +
    `Section: ${availableCourse.section} | ` +
    `Term: ${getDisplayTerm(availableCourse)} | ` +
    `${getDisplayCredits(availableCourse)}`;
}

function renderCourseOptions() {
  if (!courseOfferingSelect) {
    return;
  }

  const availableCourses = getAvailableCoursesForEnrollment();
  courseOfferingSelect.innerHTML =
    '<option value="">Choose a course</option>';

  availableCourses.forEach((course) => {
    const option = document.createElement("option");
    option.value = course.courseOfferingId;
    option.textContent = buildCourseLabel(course);
    courseOfferingSelect.appendChild(option);
  });

  courseOfferingSelect.disabled = availableCourses.length === 0;
  updateSelectedCoursePreview();
}

function createEmptyState(message) {
  const emptyState = document.createElement("div");
  emptyState.className = "courses-empty-state";
  emptyState.textContent = message;
  return emptyState;
}

function createCourseCard(course) {
  const card = document.createElement("div");
  card.className = "course-card";
  card.dataset.courseOfferingId = course.courseOfferingId;

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

  const title = document.createElement("h3");
  title.textContent = `${course.courseCode} - ${course.courseName}`;

  const professor = document.createElement("p");
  const professorLabel = document.createElement("span");
  professorLabel.className = "course-label";
  professorLabel.textContent = "Prof:";
  professor.append(professorLabel, ` ${course.instructorName}`);

  const section = document.createElement("p");
  const sectionLabel = document.createElement("span");
  sectionLabel.className = "course-label";
  sectionLabel.textContent = "Section:";
  section.append(sectionLabel, ` ${course.section}`);

  const term = document.createElement("p");
  const termLabel = document.createElement("span");
  termLabel.className = "course-label";
  termLabel.textContent = "Term:";
  term.append(termLabel, ` ${getDisplayTerm(course)}`);

  actionsMenu.appendChild(deleteButton);
  card.append(actionsButton, actionsMenu, title, professor, section, term);

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
    removeEnrollment(course.courseOfferingId);
  });

  card.addEventListener("click", () => {
    setSelectedCourse(course);
    window.location.href = `courseStudent.html?courseId=${encodeURIComponent(
      course.courseOfferingId,
    )}`;
  });

  return card;
}

function renderCourses() {
  if (!coursesList) {
    return;
  }

  coursesList.innerHTML = "";

  if (dashboardState.enrolledCourses.length === 0) {
    coursesList.appendChild(
      createEmptyState("You are not enrolled in any courses yet."),
    );
    return;
  }

  dashboardState.enrolledCourses.forEach((course) => {
    coursesList.appendChild(createCourseCard(course));
  });
}

async function getCurrentUser() {
  if (!supabaseClient) {
    throw new Error("Supabase client is not loaded.");
  }

  const {
    data: { user },
    error,
  } = await supabaseClient.auth.getUser();

  if (error) {
    throw error;
  }

  if (!user) {
    window.location.href = "login.html";
    return null;
  }

  return user;
}

async function loadAvailableCourses() {
  const { data, error } = await supabaseClient
    .from("available_courses")
    .select(
      "course_offering_id, course_code, course_name, section, instructor_name, credits, term, is_enabled",
    )
    .eq("is_enabled", true)
    .order("course_code", { ascending: true })
    .order("section", { ascending: true });

  if (error) {
    throw error;
  }

  dashboardState.allCourses = (data || []).map((course) => ({
    courseOfferingId: course.course_offering_id,
    courseCode: course.course_code,
    courseName: course.course_name,
    section: course.section,
    instructorName: course.instructor_name,
    credits: course.credits,
    term: course.term,
    isEnabled: course.is_enabled,
  }));
}

function loadSavedEnrollments() {
  if (!dashboardState.currentUser || !courseDataStore) {
    return;
  }

  const savedCourses = courseDataStore.getStudentEnrollments(
    dashboardState.currentUser.id,
  );
  const availableCourseMap = new Map(
    dashboardState.allCourses.map((course) => [course.courseOfferingId, course]),
  );

  dashboardState.enrolledCourses = savedCourses
    .map((savedCourse) => {
      const liveCourse = availableCourseMap.get(savedCourse.courseOfferingId);
      if (!liveCourse) {
        return null;
      }

      return {
        ...liveCourse,
      };
    })
    .filter(Boolean);
}

async function refreshDashboard() {
  setStatusMessage("Loading your courses...");

  try {
    await loadAvailableCourses();
    loadSavedEnrollments();
    renderCourses();
    renderCourseOptions();

    if (dashboardState.enrolledCourses.length > 0) {
      setStatusMessage("");
      return;
    }

    if (getAvailableCoursesForEnrollment().length === 0) {
      setStatusMessage("No enabled courses are available to enroll in right now.");
      return;
    }

    setStatusMessage("Choose Add Course to enroll in one of the available courses.");
  } catch (error) {
    console.error("Unable to load student dashboard courses:", error);
    renderCourses();
    renderCourseOptions();
    setStatusMessage(
      error.message || "Unable to load your courses right now.",
      true,
    );
  }
}

function addEnrollment(courseOfferingId) {
  if (!dashboardState.currentUser || !courseDataStore) {
    throw new Error("You must be logged in to enroll in a course.");
  }

  const selectedCourse = dashboardState.allCourses.find(
    (course) => course.courseOfferingId === courseOfferingId,
  );

  if (!selectedCourse) {
    throw new Error("The selected course could not be found.");
  }

  courseDataStore.upsertStudentEnrollment(
    dashboardState.currentUser.id,
    selectedCourse,
  );
}

function removeEnrollment(courseOfferingId) {
  if (!dashboardState.currentUser || !courseDataStore) {
    return;
  }

  courseDataStore.removeStudentEnrollment(
    dashboardState.currentUser.id,
    courseOfferingId,
  );
  courseDataStore.removeStudentCourseProgress(
    dashboardState.currentUser.id,
    courseOfferingId,
  );
  refreshDashboard();
}

async function initializeDashboard() {
  try {
    dashboardState.currentUser = await getCurrentUser();
    if (!dashboardState.currentUser) {
      return;
    }

    await refreshDashboard();
  } catch (error) {
    console.error("Unable to initialize student dashboard:", error);
    setStatusMessage(
      error.message || "Unable to initialize your dashboard right now.",
      true,
    );
  }
}

document.addEventListener("click", closeAllCourseMenus);

if (addCourseButton) {
  addCourseButton.addEventListener("click", () => {
    renderCourseOptions();
    openModal();
  });
}

if (closeAddCourseModal && addCourseModal) {
  closeAddCourseModal.addEventListener("click", closeModal);

  addCourseModal.addEventListener("click", (event) => {
    if (event.target === addCourseModal) {
      closeModal();
    }
  });
}

if (courseOfferingSelect) {
  courseOfferingSelect.addEventListener("change", updateSelectedCoursePreview);
}

if (addCourseForm) {
  addCourseForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const selectedCourseId = courseOfferingSelect?.value;
    if (!selectedCourseId) {
      return;
    }

    try {
      setStatusMessage("Adding course...");
      addEnrollment(selectedCourseId);
      addCourseForm.reset();
      closeModal();
      await refreshDashboard();
    } catch (error) {
      console.error("Unable to add course:", error);
      setStatusMessage(
        error.message || "Unable to add this course right now.",
        true,
      );
    }
  });
}

initializeDashboard();
