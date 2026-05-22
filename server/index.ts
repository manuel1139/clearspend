import dotenv from "dotenv";
import path from "path";
import { createApp } from "./app.js";

const envMode =
  process.env.NODE_ENV === "production" ? "production" : "development";

dotenv.config({ path: path.resolve(process.cwd(), `.env.${envMode}`) });

async function startServer() {
  const connectionString = process.env.AZURE_SQL_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error(
      `AZURE_SQL_CONNECTION_STRING is required in .env.${envMode} or the process environment`,
    );
  }

  const { app } = await createApp(connectionString);

  const port = process.env.PORT || 3000;

  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
