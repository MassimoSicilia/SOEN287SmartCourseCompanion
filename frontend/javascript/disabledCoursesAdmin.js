const supabaseClient = window.supabaseClient;
const apiClient = window.SmartCourseApi;
const disabledCoursesList = document.querySelector(".courses-list");
const DISABLED_ADMIN_PROFILE_CACHE_KEY = "smartCurrentAdminProfile";

function createEmptyState() {
  const message = document.createElement("p");
  message.className = "courses-empty-state";
  message.textContent = "No disabled courses found.";
  return message;
}

function closeAllCourseMenus() {
  document.querySelectorAll(".course-actions-menu.is-open").forEach((menu) => {
    menu.classList.remove("is-open");
  });
}

async function getCurrentAdminProfile() {
  const cachedProfile = sessionStorage.getItem(DISABLED_ADMIN_PROFILE_CACHE_KEY);
  if (cachedProfile) {
    try {
      return JSON.parse(cachedProfile);
    } catch (error) {
      sessionStorage.removeItem(DISABLED_ADMIN_PROFILE_CACHE_KEY);
    }
  }

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
    throw new Error("You must be logged in to view disabled courses.");
  }

  const profile = {
    userId: user.id,
  };

  sessionStorage.setItem(DISABLED_ADMIN_PROFILE_CACHE_KEY, JSON.stringify(profile));
  return profile;
}

async function loadDisabledCourses() {
  if (!apiClient) {
    throw new Error("Node API client is not loaded.");
  }

  const adminProfile = await getCurrentAdminProfile();
  const response = await apiClient.getCourses({
    enabled: false,
    createdByUserId: adminProfile.userId,
  });

  return (response?.courses || [])
    .filter((course) => !course.isEnabled)
    .map((course) => ({
      id: course.courseOfferingId,
      code: course.courseCode,
      name: course.courseName,
      professor: course.instructorName,
      section: course.section,
      term: course.term,
      credits: course.credits,
    }));
}

function createCourseCard(course) {
  const card = document.createElement("div");
  card.className = "course-card";
  card.dataset.courseId = course.id;

  const actionsButton = document.createElement("button");
  actionsButton.className = "course-actions-btn";
  actionsButton.type = "button";
  actionsButton.setAttribute("aria-label", `Manage ${course.code} ${course.name}`);
  actionsButton.innerHTML = "<span></span><span></span><span></span>";

  const actionsMenu = document.createElement("div");
  actionsMenu.className = "course-actions-menu";

  const enableButton = document.createElement("button");
  enableButton.className = "course-enable-btn";
  enableButton.type = "button";
  enableButton.textContent = "Enable course";

  actionsMenu.appendChild(enableButton);
  card.append(actionsButton, actionsMenu);

  const title = document.createElement("h3");
  title.textContent = `${course.code} - ${course.name}`;

  const professor = document.createElement("p");
  professor.innerHTML = `<span class="course-label">Prof:</span> ${course.professor}`;

  const section = document.createElement("p");
  section.innerHTML = `<span class="course-label">Section:</span> ${course.section}`;

  const term = document.createElement("p");
  term.innerHTML = `<span class="course-label">Term:</span> ${course.term}`;

  const credits = document.createElement("p");
  credits.innerHTML = `<span class="course-label">Credits:</span> ${course.credits}`;

  card.append(title, professor, section, term, credits);

  actionsButton.addEventListener("click", (event) => {
    event.stopPropagation();

    document.querySelectorAll(".course-actions-menu.is-open").forEach((menu) => {
      if (menu !== actionsMenu) {
        menu.classList.remove("is-open");
      }
    });

    actionsMenu.classList.toggle("is-open");
  });

  enableButton.addEventListener("click", async (event) => {
    event.stopPropagation();
    await enableCourse(course.id);
  });

  return card;
}

async function enableCourse(courseId) {
  closeAllCourseMenus();

  try {
    await apiClient.updateCourse(courseId, {
      isEnabled: true,
    });
  } catch (error) {
    alert(error.message || "Failed to enable course.");
    return;
  }

  await renderDisabledCourses();
}

async function renderDisabledCourses() {
  if (!disabledCoursesList) {
    return;
  }

  disabledCoursesList.innerHTML = "";

  try {
    const courses = await loadDisabledCourses();

    if (courses.length === 0) {
      disabledCoursesList.appendChild(createEmptyState());
      return;
    }

    courses.forEach((course) => {
      const card = createCourseCard(course);
      disabledCoursesList.appendChild(card);
    });
  } catch (error) {
    console.error("Unable to load disabled courses:", error);
    disabledCoursesList.appendChild(createEmptyState());
  }
}

document.addEventListener("click", closeAllCourseMenus);

renderDisabledCourses();
