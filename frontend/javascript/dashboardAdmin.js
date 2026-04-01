const supabaseClient = window.supabaseClient;

const createCourseButton = document.getElementById("create-course-btn");
const createCourseModal = document.getElementById("create-course-modal");
const closeCreateCourseModal = document.getElementById(
  "close-create-course-modal",
);
const createCourseForm = document.getElementById("create-course-form");
const coursesList = document.querySelector(".courses-list");

function setSelectedAdminCourse(course) {
  if (!course) {
    sessionStorage.removeItem("selectedAdminCourse");
    return;
  }

  sessionStorage.setItem("selectedAdminCourse", JSON.stringify(course));
}

function closeAllCourseMenus() {
  document.querySelectorAll(".course-actions-menu.is-open").forEach((menu) => {
    menu.classList.remove("is-open");
  });
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

  const disableButton = document.createElement("button");
  disableButton.className = "course-disable-btn";
  disableButton.type = "button";
  disableButton.textContent = "Disable course";

  const deleteButton = document.createElement("button");
  deleteButton.className = "course-delete-btn";
  deleteButton.type = "button";
  deleteButton.textContent = "Delete course";

  const title = document.createElement("h3");
  title.textContent = `${course.code} - ${course.name}`;

  const professor = document.createElement("p");
  professor.innerHTML = `<span class="course-label">Prof:</span> ${course.instructorName}`;

  const section = document.createElement("p");
  section.innerHTML = `<span class="course-label">Section:</span> ${course.section}`;

  const credits = document.createElement("p");
  credits.innerHTML = `<span class="course-label">Credits:</span> ${course.credits}`;

  actionsMenu.append(disableButton, deleteButton);
  card.append(actionsButton, actionsMenu, title, professor, section, credits);

  actionsButton.addEventListener("click", (event) => {
    event.stopPropagation();

    document.querySelectorAll(".course-actions-menu.is-open").forEach((menu) => {
      if (menu !== actionsMenu) {
        menu.classList.remove("is-open");
      }
    });

    actionsMenu.classList.toggle("is-open");
  });

  disableButton.addEventListener("click", async (event) => {
    event.stopPropagation();
    await disableCourse(course.id);
  });

  deleteButton.addEventListener("click", async (event) => {
    event.stopPropagation();
    await deleteCourse(course.id);
  });

  return card;
}

function createEmptyState() {
  const message = document.createElement("p");
  message.className = "courses-empty-state";
  message.textContent = "No Current Courses Available";
  return message;
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
    throw new Error("You must be logged in to create a course.");
  }

  const firstName = user.user_metadata?.first_name?.trim() || "";
  const lastName = user.user_metadata?.last_name?.trim() || "";
  const fullName = `${firstName} ${lastName}`.trim();

  if (!fullName) {
    throw new Error("Your account is missing a first or last name.");
  }

  return {
    userId: user.id,
    fullName,
  };
}

async function loadCourses() {
  if (!supabaseClient) {
    throw new Error("Supabase client is not loaded.");
  }

  const adminProfile = await getCurrentAdminProfile();

  const { data, error } = await supabaseClient
    .from("available_courses")
    .select(
      "course_offering_id, course_code, course_name, section, instructor_name, credits, is_enabled, created_by_user_id",
    )
    .eq("is_enabled", true)
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
    section: course.section,
    instructorName: course.instructor_name,
    credits: course.credits,
    term: course.term,
  }));
}

async function disableCourse(courseId) {
  const confirmed = window.confirm(
    "Disable this course? It will appear on the Disabled Courses page.",
  );

  if (!confirmed) {
    return;
  }

  closeAllCourseMenus();

  const { error } = await supabaseClient
    .from("available_courses")
    .update({
      is_enabled: false,
      updated_at: new Date().toISOString(),
    })
    .eq("course_offering_id", courseId);

  if (error) {
    alert(error.message || "Failed to disable course.");
    return;
  }

  await renderCourses();
}

async function deleteCourse(courseId) {
  const confirmed = window.confirm(
    "Delete this course permanently? This cannot be undone.",
  );

  if (!confirmed) {
    return;
  }

  closeAllCourseMenus();

  const { error } = await supabaseClient
    .from("available_courses")
    .delete()
    .eq("course_offering_id", courseId);

  if (error) {
    alert(error.message || "Failed to delete course.");
    return;
  }

  await renderCourses();
}

async function renderCourses() {
  if (!coursesList) {
    return;
  }

  coursesList.innerHTML = "";

  try {
    const courses = await loadCourses();

    if (courses.length === 0) {
      coursesList.appendChild(createEmptyState());
      return;
    }

    courses.forEach((course) => {
      const card = createCourseCard(course);
      addCourseCardClickHandler(card, course);
      coursesList.appendChild(card);
    });
  } catch (error) {
    console.error("Unable to load available courses:", error);
    coursesList.appendChild(createEmptyState());
  }
}

function addCourseCardClickHandler(card, course) {
  if (!card) {
    return;
  }

  card.addEventListener("click", () => {
    setSelectedAdminCourse(course);
    window.location.href = `courseAdmin.html?courseId=${encodeURIComponent(
      course.id,
    )}`;
  });
}

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
  createCourseForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const courseName = document.getElementById("course-name")?.value.trim();
    const courseCode = document.getElementById("course-code")?.value.trim();
    const section = document
      .getElementById("section")
      ?.value.trim()
      .toUpperCase();
    const credits = document.getElementById("course-credits")?.value.trim();
    const term = document.getElementById("term")?.value;

    if (credits && !/^\d+$/.test(credits)) {
      alert("Credits must be a number.");
      document.getElementById("course-credits").value = "";
      return;
    }

    if (!courseName || !courseCode || !section || !credits || !term) {
      return;
    }

    const submitButton = createCourseForm.querySelector(
      'button[type="submit"]',
    );

    if (submitButton) {
      submitButton.disabled = true;
    }

    try {
      const adminProfile = await getCurrentAdminProfile();
      const timestamp = new Date().toISOString();
      const { error } = await supabaseClient.from("available_courses").insert({
        course_code: courseCode,
        course_name: courseName,
        section,
        instructor_name: adminProfile.fullName,
        credits: Number(credits),
        term,
        created_by_user_id: adminProfile.userId,
        created_at: timestamp,
        updated_at: timestamp,
      });

      if (error) {
        throw error;
      }

      createCourseForm.reset();
      closeModal();
      await renderCourses();
    } catch (error) {
      alert(error.message || "Failed to create course.");
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  });
}

document.addEventListener("click", closeAllCourseMenus);

renderCourses();
