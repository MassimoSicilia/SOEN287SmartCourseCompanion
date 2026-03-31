const signUpForm = document.getElementById("signUpForm");
const isStudentRadio = document.getElementById("isStudent");
const isInstructorRadio = document.getElementById("isInstructor");
const idDiv = document.getElementById("IdDiv");
const studentIdInput = document.getElementById("studentID");
const supabaseClient = window.supabaseClient;

//helper method to show/hide student ID field based on selected account type
function toggleStudentIdVisibility() {
  const isStudent = isStudentRadio?.checked;
  if (idDiv) {
    idDiv.style.display = isStudent ? "block" : "none";
  }

  if (studentIdInput) {
    studentIdInput.required = Boolean(isStudent);
    if (!isStudent) {
      studentIdInput.value = "";
    }
  }
}

if (isStudentRadio) {
  isStudentRadio.addEventListener("change", toggleStudentIdVisibility);
}

if (isInstructorRadio) {
  isInstructorRadio.addEventListener("change", toggleStudentIdVisibility);
}

if (signUpForm) {
  signUpForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!supabaseClient) {
      alert(
        "Supabase client is not loaded. Check signUp.html script order and frontend/javascript/supabaseClient.js.",
      );
      return;
    }

    const password = document.getElementById("password").value.trim();
    const confirmPasswordInput = document.getElementById("passwordWord2");
    const firstName = document.getElementById("first_name").value.trim();
    const lastName = document.getElementById("last_name").value.trim();
    const email = document.getElementById("email").value.trim();
    const studentID = studentIdInput?.value.trim() || null;
    const role = isStudentRadio?.checked
      ? AccountStatus.STUDENT
      : AccountStatus.ADMIN;

    if (password !== confirmPasswordInput.value) {
      alert("Passwords do not match.");
      return;
    }

    try {
      //supabase logic
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            role,
            student_id: role === AccountStatus.STUDENT ? studentID : null,
          },
        },
      });

      if (error) {
        alert(error.message);
        return;
      }

      console.log("Supabase account created:", data?.user);
      alert("Account created successfully.");

      if (isInstructorRadio?.checked) {
        window.location.href = "../adminPages/dashboardAdmin.html";
      } else if (isStudentRadio?.checked) {
        window.location.href = "../studentPages/dashboardStudent.html";
      }
    } catch (error) {
      alert(error.message);
    }
  });
}

toggleStudentIdVisibility();
