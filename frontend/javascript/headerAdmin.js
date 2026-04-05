const ADMIN_HEADER_CACHE_KEY = "smartAdminHeaderMarkup:v3";
const ADMIN_PROFILE_CACHE_KEY = "smartCurrentAdminProfile";
const ADMIN_USER_ID_CACHE_KEY = "smartCurrentAdminUserId";

async function populateHeaderUserName() {
  const nameElement = document.getElementById("header-user-name");
  if (!nameElement || !window.supabaseClient) {
    return;
  }

  try {
    const {
      data: { user },
      error,
    } = await window.supabaseClient.auth.getUser();

    if (error) {
      throw error;
    }

    if (!user) {
      nameElement.textContent = "";
      return;
    }

    const firstName = String(user.user_metadata?.first_name || "").trim();
    const lastName = String(user.user_metadata?.last_name || "").trim();
    nameElement.textContent = `${firstName} ${lastName}`.trim();
  } catch (error) {
    console.error("Unable to load admin name:", error);
    nameElement.textContent = "";
  }
}

function initializeHeaderBehavior(container) {
  function getSelectedCoursePath() {
    const selectedCourse = sessionStorage.getItem("selectedAdminCourse");
    if (!selectedCourse) {
      return "courseAdmin.html";
    }

    try {
      const parsedCourse = JSON.parse(selectedCourse);
      if (parsedCourse?.id) {
        return `courseAdmin.html?courseId=${encodeURIComponent(parsedCourse.id)}`;
      }
    } catch (error) {
      console.error("Unable to parse selected admin course:", error);
    }

    return "courseAdmin.html";
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

  if (menuCloseButton) {
    menuCloseButton.addEventListener("click", () => {
      if (offScreenMenu) {
        offScreenMenu.classList.remove("is-open");
      }
      if (menuButton) {
        menuButton.setAttribute("aria-expanded", "false");
      }
    });
  }

  const dashboardMenuItem = document.getElementById("dashboard-menu-item");
  if (dashboardMenuItem) {
    dashboardMenuItem.onclick = function () {
      window.location.href = "dashboardAdmin.html";
    };
  }

  const disabledCoursesMenuItem = document.getElementById(
    "disabled-courses-menu-item",
  );
  if (disabledCoursesMenuItem) {
    disabledCoursesMenuItem.onclick = function () {
      window.location.href = "disabledCoursesAdmin.html";
    };
  }

  const specificCourseMenuItem = document.getElementById("specific-course-menu-item");
  if (specificCourseMenuItem) {
    specificCourseMenuItem.onclick = function () {
      window.location.href = getSelectedCoursePath();
    };
  }

  const analyticsMenuItem = document.getElementById("analytics-menu-item");
  if (analyticsMenuItem) {
    analyticsMenuItem.onclick = function () {
      window.location.href = "analyticsAdmin.html";
    };
  }

  const signOutMenuItem = document.getElementById("sign-out-menu-item");
  if (signOutMenuItem) {
    signOutMenuItem.onclick = async function () {
      try {
        if (window.supabaseClient) {
          await window.supabaseClient.auth.signOut();
        }
      } catch (error) {
        console.error("Unable to sign out cleanly:", error);
      }

      sessionStorage.removeItem("selectedAdminCourse");
      sessionStorage.removeItem(ADMIN_PROFILE_CACHE_KEY);
      sessionStorage.removeItem(ADMIN_USER_ID_CACHE_KEY);
      window.location.href = "../studentPages/login.html";
    };
  }

  const titleElement = document.getElementById("header-page-title");
  const desiredTitle = container.dataset.headerTitle;
  if (titleElement && desiredTitle) {
    titleElement.textContent = desiredTitle;
  }

  const activeMenu = container.dataset.activeMenu;
  const activeByKey = {
    dashboard: dashboardMenuItem,
    disabledCourses: disabledCoursesMenuItem,
    course: specificCourseMenuItem,
    analytics: analyticsMenuItem
  };
  const activeElement = activeMenu ? activeByKey[activeMenu] : null;
  if (activeElement) {
    activeElement.classList.add("menu-item-active");
  }
}

async function loadSharedHeader() {
  const headerContainer = document.getElementById("site-header");
  if (!headerContainer) {
    return;
  }

  const cachedHeaderMarkup = sessionStorage.getItem(ADMIN_HEADER_CACHE_KEY);
  if (cachedHeaderMarkup) {
    headerContainer.innerHTML = cachedHeaderMarkup;
    initializeHeaderBehavior(headerContainer);
    void populateHeaderUserName();
    return;
  }

  try {
    const headerSource = headerContainer.dataset.headerSrc || "headerAdmin.html";
    const response = await fetch(headerSource);
    if (!response.ok) {
      throw new Error(`Header load failed with status ${response.status}`);
    }
    const headerMarkup = await response.text();
    sessionStorage.setItem(ADMIN_HEADER_CACHE_KEY, headerMarkup);
    headerContainer.innerHTML = headerMarkup;
    initializeHeaderBehavior(headerContainer);
    void populateHeaderUserName();
  } catch (error) {
    console.error("Unable to load shared header:", error);
  }
}

loadSharedHeader();
