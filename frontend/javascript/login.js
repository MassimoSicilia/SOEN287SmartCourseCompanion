const loginForm = document.getElementById("loginForm");

if (loginForm) {
  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("passwordWord2").value;

    //Temporary password confirmation check for login form, can be removed later if not needed.
    if (password !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }

    const account = accountStore.authenticate(username, password);
    if (!account) {
      alert("Invalid username or password.");
      return;
    }

    if (account.status === AccountStatus.ADMIN) {
      //to be redirected to the admin dashboard when implemented
      window.location.href = "dashboardStudent.html";
      return;
    }

    window.location.href = "dashboardStudent.html";
  });
}
