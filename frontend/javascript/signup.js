const signUpForm = document.getElementById("signUpForm");
const isStudentRadio = document.getElementById("isStudent");
const isInstructorRadio = document.getElementById("isInstructor");
const idDiv = document.getElementById("IdDiv");
const studentIdInput = document.getElementById("studentID");

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
  signUpForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const passwordInput = document.getElementById("password");
    const confirmPasswordInput = document.getElementById("passwordWord2");

    if (passwordInput.value !== confirmPasswordInput.value) {
      alert("Passwords do not match.");
      return;
    }

    const selectedStatus = isStudentRadio?.checked
      ? AccountStatus.STUDENT
      : AccountStatus.ADMIN;

    try {
      accountStore.addAccount({
        username: document.getElementById("username").value,
        email: document.getElementById("email").value,
        password: passwordInput.value,
        status: selectedStatus,
        studentId: studentIdInput?.value || null,
      });

      alert("Account created successfully. Please log in.");
      window.location.href = "login.html";
    } catch (error) {
      alert(error.message);
    }
  });
}

toggleStudentIdVisibility();
