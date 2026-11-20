import { spawnSync } from "node:child_process";
const env = { ...process.env, PROPIT_MODE: process.env.VERCEL_ENV === "production" ? "production" : "preview" };
if (env.PROPIT_MODE === "production") {
  const check = spawnSync(process.execPath, ["--import", "tsx", "scripts/check-production.ts"], { stdio: "inherit", env });
  if (check.status !== 0) process.exit(check.status ?? 1);
}
const build = spawnSync(process.execPath, ["node_modules/next/dist/bin/next", "build"], { stdio: "inherit", env });
process.exit(build.status ?? 1);
