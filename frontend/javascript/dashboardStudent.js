document.getElementById("add-course-btn").onclick = function() {
    window.location.href = "addCourse.html";
}

const menuButton = document.getElementById("menu-button");
const offScreenMenu = document.getElementById("off-screen-menu");
const menuCloseButton = document.getElementById("menu-close-button");

menuButton.addEventListener("click", () => {
    const isOpen = offScreenMenu.classList.toggle("is-open");
    menuButton.setAttribute("aria-expanded", String(isOpen));
});

if (menuCloseButton) {
    menuCloseButton.addEventListener("click", () => {
        offScreenMenu.classList.remove("is-open");
        menuButton.setAttribute("aria-expanded", "false");
    });
}
