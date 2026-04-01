const supabaseClient = window.supabaseClient;
const disabledCoursesList = document.querySelector(".courses-list");

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

  return {
    userId: user.id,
  };
}

async function loadDisabledCourses() {
  const adminProfile = await getCurrentAdminProfile();

  const { data, error } = await supabaseClient
    .from("available_courses")
    .select(
      "course_offering_id, course_code, course_name, section, instructor_name, term, credits, is_enabled, created_by_user_id",
    )
    .eq("is_enabled", false)
    .eq("created_by_user_id", adminProfile.userId)
    .order("course_code", { ascending: true })
    .order("section", { ascending: true });

  if (error) {
    throw error;
  }

  return (data || []).map((course) => ({
    id: course.course_offering_id,
    code: course.course_code,
    name: course.course_name,
    professor: course.instructor_name,
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

  const { error } = await supabaseClient
    .from("available_courses")
    .update({
      is_enabled: true,
      updated_at: new Date().toISOString(),
    })
    .eq("course_offering_id", courseId);

  if (error) {
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
