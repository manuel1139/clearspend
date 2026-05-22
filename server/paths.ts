import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function findUp(startDir: string, predicate: (dir: string) => boolean) {
  let currentDir = startDir;

  while (true) {
    if (predicate(currentDir)) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return null;
    }

    currentDir = parentDir;
  }
}

export function findRepoRoot() {
  const repoRoot = findUp(__dirname, (dir) =>
    fs.existsSync(path.join(dir, "vite.config.ts")),
  );

  if (!repoRoot) {
    throw new Error("Unable to locate the repository root from the server.");
  }

  return repoRoot;
}

export function findEnvFile(envMode: string) {
  const envFileName = `.env.${envMode}`;
  const envDir = findUp(__dirname, (dir) =>
    fs.existsSync(path.join(dir, envFileName)),
  );

  if (!envDir) {
    return null;
  }

  return path.join(envDir, envFileName);
}
