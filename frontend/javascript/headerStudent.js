function initializeHeaderBehavior(container) {
  function getSelectedCoursePath() {
    const selectedCourse = sessionStorage.getItem("selectedStudentCourse");
    if (!selectedCourse) {
      return "courseStudent.html";
    }

    try {
      const parsedCourse = JSON.parse(selectedCourse);
      if (parsedCourse?.courseOfferingId) {
        return `courseStudent.html?courseId=${encodeURIComponent(
          parsedCourse.courseOfferingId,
        )}`;
      }
    } catch (error) {
      console.error("Unable to parse selected student course:", error);
    }

    return "courseStudent.html";
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
      window.location.href = "dashboardStudent.html";
    };
  }

  const specificCourseMenuItem = document.getElementById("specific-course-menu-item");
  if (specificCourseMenuItem) {
    specificCourseMenuItem.onclick = function () {
      window.location.href = getSelectedCoursePath();
    };
  }

  const gradesMenuItem = document.getElementById("grades-menu-item");
  if (gradesMenuItem) {
    gradesMenuItem.onclick = function () {
      window.location.href = "gradesStudent.html";
    };
  }

  const analyticsMenuItem = document.getElementById("analytics-menu-item");
  if (analyticsMenuItem) {
    analyticsMenuItem.onclick = function () {
      window.location.href = "analyticsStudent.html";
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

      sessionStorage.removeItem("selectedStudentCourse");
      window.location.href = "login.html";
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
    course: specificCourseMenuItem,
    grades: gradesMenuItem,
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

  try {
    const headerSource = headerContainer.dataset.headerSrc || "headerStudent.html";
    const response = await fetch(headerSource);
    if (!response.ok) {
      throw new Error(`Header load failed with status ${response.status}`);
    }
    headerContainer.innerHTML = await response.text();
    initializeHeaderBehavior(headerContainer);
  } catch (error) {
    console.error("Unable to load shared header:", error);
  }
}

loadSharedHeader();
