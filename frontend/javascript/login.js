const loginForm = document.getElementById("loginForm");

if (loginForm) {
  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    const account = accountStore.authenticate(username, password);
    if (!account) {
      alert("Invalid username or password.");
      return;
    }

    const isAdmin =
      account?.status === AccountStatus?.ADMIN ||
      account?.status?.toLowerCase?.() === "admin";

    if (isAdmin) {
      window.location.href = "../adminPages/dashboardAdmin.html";
      return;
    }

    window.location.href = "dashboardStudent.html";
  });
}
