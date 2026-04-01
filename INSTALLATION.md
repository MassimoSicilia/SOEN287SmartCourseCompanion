# Smart Course Companion - Installation Guide

## 1. Prerequisites

- A modern browser (Chrome, Edge, Firefox, or Safari)
- Git
- Optional: VS Code + Live Server extension

Note: The project now uses a Node.js backend for the main course, template, enrollment, and progress data flows. Run the API before opening the frontend.

## 2. Clone the Repository

```bash
git clone https://github.com/MassimoSicilia/SOEN287SmartCourseCompanion.git
cd SOEN287SmartCourseCompanion
```

## 3. Run the Project Locally

Node.js backend

1. Open a terminal in `node/`.
2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in `node/` with your database connection string:

```env
DATABASE_URL=your_postgres_connection_string
PORT=3000
```

4. Start the API:

```bash
npm start
```

VS Code + Live Server (recommended)

1. Open the project folder in VS Code.
2. Install the `Live Server` extension (if not already installed).
3. Open one of these pages:
   - `frontend/pages/studentPages/login.html` (student flow)
   - `frontend/pages/adminPages/dashboardAdmin.html` (admin flow)
4. Right-click the file and select `Open with Live Server`.

## 4. Basic Usage Notes

- Authentication still uses Supabase on the frontend.
- Main app data now flows through the Node.js API.

## 5. Reset Local Data (if needed)

If login/signup data becomes inconsistent:

1. Open browser DevTools.
2. Go to `Application` (or `Storage`) tab.
3. Remove localStorage key: `smartCourseAccounts`.
4. Refresh the page.

## 6. Troubleshooting

- Page not loading styles/scripts:
  - Make sure you are serving files through Live Server or a local HTTP server.
  - Avoid opening files directly with `file://`.

- Live reload keeps refreshing:
  - Restart Live Server.
  - Disable auto-refresh browser extensions.
  - In VS Code workspace settings, ignore noisy files like `.git`, `.DS_Store`, and `.vscode` for Live Server.

- Login fails unexpectedly:
  - Confirm account exists in localStorage (`smartCourseAccounts`).
  - Clear localStorage and create a fresh account.

## 7. Project Structure (high level)

```text
frontend/
  pages/         # HTML pages (student/admin views)
  css/           # Shared and page-specific styles
  javascript/    # Page logic and account storage/auth scripts
```
