import "dotenv/config";
import app from "./app.js";
import { initializeDatabase } from "./db.js";

const port = Number(process.env.PORT) || 3000;

async function startServer() {
  await initializeDatabase();

  app.listen(port, () => {
    console.log(`Smart Course Companion API listening on http://localhost:${port}`);
  });
}

startServer().catch((error) => {
  console.error("Unable to start Smart Course Companion API:", error);
  process.exit(1);
});
