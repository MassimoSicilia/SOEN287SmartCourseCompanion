const loginForm = document.getElementById("loginForm");
const supabaseClient = window.supabaseClient;

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!supabaseClient) {
      alert("Supabase client is not loaded.");
      return;
    }

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        alert(error.message);
        return;
      }

      const user = data.user;
      const metadata = user.user_metadata;

      console.log("Logged in:", user);
      console.log("Role:", metadata.role);
      console.log("Username:", metadata.username);

      // Mirror your sign-up redirect logic using the stored role
      if (metadata.role === AccountStatus.ADMIN) {
        window.location.href = "../adminPages/dashboardAdmin.html";
      } else if (metadata.role === AccountStatus.STUDENT) {
        window.location.href = "../studentPages/dashboardStudent.html";
      } else {
        alert("Unknown role. Contact support.");
      }
    } catch (err) {
      alert(err.message);
    }
  });
}
