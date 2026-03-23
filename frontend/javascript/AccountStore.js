// AccountStore persists accounts in localStorage while keeping an in-memory array.
class AccountStore {
  constructor(storageKey = "smartCourseAccounts") {
    this.storageKey = storageKey;
    this.accounts = [];
    this.loadAccounts();
  }

  loadAccounts() {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) {
      this.accounts = [];
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        this.accounts = [];
        return;
      }

      this.accounts = parsed
        .map((accountData) => {
          try {
            return new Account(accountData);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
      console.log(`Loaded ${this.accounts.length} accounts from localStorage.`);
    } catch {
      this.accounts = [];
    }
  }

  saveAccounts() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.accounts));
  }

  getAllAccounts() {
    return [...this.accounts];
  }

  findByUsername(username) {
    if (!username) {
      return null;
    }

    const normalized = username.trim().toLowerCase();
    return (
      this.accounts.find(
        (account) => account.username.toLowerCase() === normalized,
      ) || null
    );
  }

  addAccount(accountData) {
    const account =
      accountData instanceof Account ? accountData : new Account(accountData);

    if (this.findByUsername(account.username)) {
      throw new Error("An account with this username already exists.");
    }

    const emailTaken = this.accounts.some(
      (existingAccount) =>
        existingAccount.email.toLowerCase() === account.email.toLowerCase(),
    );

    if (emailTaken) {
      throw new Error("An account with this email already exists.");
    }

    this.accounts.push(account);
    this.saveAccounts();
    return account;
  }

  authenticate(username, password) {
    const account = this.findByUsername(username);
    if (!account) {
      return null;
    }

    return account.password === password ? account : null;
  }
}

const accountStore = new AccountStore();
window.accountStore = accountStore;
window.AccountStore = AccountStore;
