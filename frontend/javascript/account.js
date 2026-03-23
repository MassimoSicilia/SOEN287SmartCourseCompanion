// Account status enum-like object.
const AccountStatus = Object.freeze({
  ADMIN: "admin",
  STUDENT: "student",
});

class Account {
  constructor({ username, email, password, status, studentId = null }) {
    this.username = username?.trim() || "";
    this.email = email?.trim() || "";
    this.password = password || "";
    this.status = status;
    this.studentId = studentId?.trim() || null;

    this.validate();
  }

  validate() {
    if (!this.username) {
      throw new Error("Username is required.");
    }

    if (!this.email) {
      throw new Error("Email is required.");
    }

    if (!this.password) {
      throw new Error("Password is required.");
    }

    const validStatuses = Object.values(AccountStatus);
    if (!validStatuses.includes(this.status)) {
      throw new Error("Status must be either admin or student.");
    }

    if (this.status === AccountStatus.STUDENT && !this.studentId) {
      throw new Error("Student ID is required for student accounts.");
    }

    if (this.status === AccountStatus.ADMIN) {
      this.studentId = null;
    }
  }

  isAdmin() {
    return this.status === AccountStatus.ADMIN;
  }

  isStudent() {
    return this.status === AccountStatus.STUDENT;
  }
}
