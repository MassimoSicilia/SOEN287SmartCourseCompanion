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
const upcomingAssignmentsList = document.getElementById("upcomingAssignmentsList");

const dashboardState = {
  currentUser: null,
  allCourses: [],
  enrolledCourses: [],
  upcomingAssignments: [],
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

function createUpcomingAssignmentRow(assignment) {
  const row = document.createElement("div");
  row.className = "assignment-row";

  const task = document.createElement("span");
  task.textContent = assignment.task;

  const due = document.createElement("span");
  due.textContent = assignment.dueDisplay;

  const status = document.createElement("span");
  status.className = "status-pill";
  if (assignment.statusClassName) {
    status.classList.add(assignment.statusClassName);
  }
  status.textContent = assignment.statusLabel;

  row.append(task, due, status);
  return row;
}

function renderUpcomingAssignments() {
  if (!upcomingAssignmentsList) {
    return;
  }

  upcomingAssignmentsList.innerHTML = "";

  if (dashboardState.upcomingAssignments.length === 0) {
    upcomingAssignmentsList.appendChild(
      createUpcomingAssignmentRow({
        task: "No upcoming assessments yet",
        dueDisplay: "--",
        statusLabel: "Not Started",
        statusClassName: "not-started",
      }),
    );
    return;
  }

  dashboardState.upcomingAssignments.forEach((assignment) => {
    upcomingAssignmentsList.appendChild(createUpcomingAssignmentRow(assignment));
  });
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

function parseDashboardDate(value) {
  const trimmedValue = String(value || "").trim();
  const dateOnlyMatch = trimmedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
    );
  }

  return new Date(trimmedValue);
}

function formatDashboardDueDate(value) {
  const parsedDate = parseDashboardDate(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return "--";
  }

  return parsedDate.toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
  });
}

function getDashboardStatusPresentation(status) {
  if (status === "Submitted") {
    return {
      statusLabel: "Complete",
      statusClassName: "",
    };
  }

  if (status === "In progress") {
    return {
      statusLabel: "In Progress",
      statusClassName: "in-progress",
    };
  }

  return {
    statusLabel: "Not Started",
    statusClassName: "not-started",
  };
}

async function loadUpcomingAssignments() {
  if (!dashboardState.currentUser || !courseDataStore) {
    dashboardState.upcomingAssignments = [];
    return;
  }

  const templates = await Promise.all(
    dashboardState.enrolledCourses.map(async (course) => {
      const template = await courseDataStore.loadCourseTemplate(
        course.courseOfferingId,
      );

      return {
        course,
        assessments: template.assessments,
      };
    }),
  );

  const nextAssignments = [];

  templates.forEach(({ course, assessments }) => {
    const courseProgress = courseDataStore.getStudentCourseProgress(
      dashboardState.currentUser.id,
      course.courseOfferingId,
    );

    assessments.forEach((assessment) => {
      const progress = courseProgress[assessment.id] || {
        grade: "",
        status: "Not started",
      };
      const statusDetails = getDashboardStatusPresentation(progress.status);

      nextAssignments.push({
        task: `${assessment.name} (${course.courseCode})`,
        dueDate: assessment.dueDate,
        dueDisplay: formatDashboardDueDate(assessment.dueDate),
        statusLabel: statusDetails.statusLabel,
        statusClassName: statusDetails.statusClassName,
      });
    });
  });

  nextAssignments.sort((left, right) => {
    const leftTimestamp = parseDashboardDate(left.dueDate || "").getTime();
    const rightTimestamp = parseDashboardDate(right.dueDate || "").getTime();

    if (Number.isNaN(leftTimestamp) && Number.isNaN(rightTimestamp)) {
      return left.task.localeCompare(right.task);
    }

    if (Number.isNaN(leftTimestamp)) {
      return 1;
    }

    if (Number.isNaN(rightTimestamp)) {
      return -1;
    }

    return leftTimestamp - rightTimestamp;
  });

  dashboardState.upcomingAssignments = nextAssignments.slice(0, 6);
}

async function refreshDashboard() {
  setStatusMessage("Loading your courses...");

  try {
    await loadAvailableCourses();
    loadSavedEnrollments();
    await loadUpcomingAssignments();
    renderCourses();
    renderUpcomingAssignments();
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
    renderUpcomingAssignments();
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
