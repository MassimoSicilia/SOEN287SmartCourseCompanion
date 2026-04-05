(function initializeSiteTheme() {
  const THEME_STORAGE_KEY = "smartCourseTheme";

  function getStoredTheme() {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY);
    } catch (error) {
      return null;
    }
  }

  function applyTheme(theme, persist = false) {
    const nextTheme = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.style.colorScheme = nextTheme;

    if (!persist) {
      return;
    }

    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch (error) {
      // Ignore storage failures and keep the applied theme in memory.
    }
  }

  function getTheme() {
    return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  }

  function syncToggle(button) {
    if (!button) {
      return;
    }

    const isDark = getTheme() === "dark";
    button.setAttribute("aria-pressed", String(isDark));
    button.setAttribute(
      "aria-label",
      isDark ? "Switch to light mode" : "Switch to dark mode",
    );

    const thumb = button.querySelector(".theme-toggle-switch-thumb");
    const label = button.querySelector(".theme-toggle-switch-label");

    if (thumb) {
      thumb.setAttribute("data-theme-state", isDark ? "dark" : "light");
    }

    if (label) {
      label.textContent = isDark ? "Dark" : "Light";
    }
  }

  function toggleTheme() {
    const nextTheme = getTheme() === "dark" ? "light" : "dark";
    applyTheme(nextTheme, true);
    return nextTheme;
  }

  function mountStandaloneToggle() {
    if (document.getElementById("theme-toggle-button")) {
      return;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.id = "theme-toggle-button";
    button.className = "theme-toggle-switch";
    button.innerHTML = `
      <span class="theme-toggle-switch-track">
        <span class="theme-toggle-switch-thumb" aria-hidden="true"></span>
      </span>
      <span class="theme-toggle-switch-label"></span>
    `;
    button.addEventListener("click", () => {
      toggleTheme();
      syncToggle(button);
    });
    syncToggle(button);
    document.body.appendChild(button);
  }

  applyTheme(getStoredTheme() || "light");

  document.addEventListener("DOMContentLoaded", mountStandaloneToggle);

  window.SiteTheme = {
    getTheme,
    setTheme(theme) {
      applyTheme(theme, true);
    },
    toggleTheme,
    syncToggle,
    mountStandaloneToggle,
  };
})();
