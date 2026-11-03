import { execSync } from "child_process";
import fs from "fs";
import path from "path";

/** Fresh SQLite test database (prisma/test.db) for each run. */
export default function setup() {
  for (const f of ["test.db", "test.db-journal"]) fs.rmSync(path.join(__dirname, "prisma", f), { force: true });
  execSync("npx prisma db push --skip-generate", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
  });
}
