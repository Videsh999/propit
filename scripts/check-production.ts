import { checkProduction } from "../src/lib/production-check";
async function main() {
process.env.PROPIT_MODE = "production";
const failures = await checkProduction();
if (failures.length) {
  console.error("Production launch blocked:");
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exitCode = 1;
} else console.log("Production dependencies verified. Complete the real email/Google and customer acceptance checks in docs/PRODUCTION.md before promotion.");
}
void main().catch(() => { console.error("Production launch blocked: readiness check could not finish."); process.exitCode = 1; });
