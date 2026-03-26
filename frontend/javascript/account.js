// Account status enum-like object.
const AccountStatus = Object.freeze({
  ADMIN: "admin",
  STUDENT: "student",
});

//removed password param so not the Account object represents rows in the DB
class Account {
  constructor({ username, email, status, studentId = null, db_ID = null }) {
    this.username = username?.trim() || "";
    this.email = email?.trim() || "";
    this.status = status;
    this.studentId = studentId?.trim() || null;
    this.db_ID = db_ID;

    this.validate();
  }

  validate() {
    if (!this.username) {
      throw new Error("Username is required.");
    }

    if (!this.email) {
      throw new Error("Email is required.");
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
