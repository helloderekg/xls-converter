// Dependency audit gate: fails on any advisory that is not explicitly accepted
// in .audit-allowlist.json. Acceptances are time-boxed, so an expired entry
// fails the build until it is re-reviewed. No dependencies of its own.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const allowlistPath = resolve(root, ".audit-allowlist.json");

// npm audit exits non-zero whenever it finds anything, so read stdout from the
// error too. A broken audit (bad lockfile, registry down) still prints JSON, but
// as {"error": ...} with no vulnerabilities key, which would otherwise read as a
// clean tree. Treat anything that is not a real report as a failure.
function runAudit() {
  // Windows resolves npm through npm.cmd, which Node will only spawn via a
  // shell. The command and its arguments are literals, so nothing is injectable.
  const isWindows = process.platform === "win32";
  const opts = {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    shell: isWindows,
  };
  let stdout;
  try {
    stdout = execFileSync(isWindows ? "npm.cmd" : "npm", ["audit", "--json"], opts);
  } catch (err) {
    if (!err.stdout) throw err;
    stdout = err.stdout;
  }
  const report = JSON.parse(stdout);
  if (report.error) {
    const { code, summary, detail } = report.error;
    throw new Error(`npm audit failed (${code ?? "no code"}): ${summary ?? ""}\n${detail ?? ""}`);
  }
  if (typeof report.vulnerabilities !== "object" || report.vulnerabilities === null) {
    throw new Error("npm audit returned no vulnerabilities report; refusing to treat that as clean.");
  }
  return report;
}

// Root-cause advisories are the object entries in `via`; string entries are
// just packages that inherit the problem from a dependency.
function collectAdvisories(report) {
  const found = new Map();
  for (const vuln of Object.values(report.vulnerabilities)) {
    for (const via of vuln.via ?? []) {
      if (typeof via !== "object" || !via.url) continue;
      const id = via.url.split("/").pop();
      if (!found.has(id)) {
        found.set(id, {
          id,
          package: via.name,
          severity: via.severity,
          range: via.range,
          title: via.title,
          url: via.url,
        });
      }
    }
  }
  return found;
}

const report = runAudit();
const advisories = collectAdvisories(report);
const allowlist = JSON.parse(readFileSync(allowlistPath, "utf8")).accepted;
const accepted = new Map(allowlist.map((entry) => [entry.id, entry]));
const today = new Date().toISOString().slice(0, 10);

const unaccepted = [];
const expired = [];
for (const advisory of advisories.values()) {
  const entry = accepted.get(advisory.id);
  if (!entry) unaccepted.push(advisory);
  else if (entry.reviewBy < today) expired.push({ advisory, entry });
}
const stale = allowlist.filter((entry) => !advisories.has(entry.id));

for (const { advisory, entry } of expired) {
  console.error(
    `EXPIRED ACCEPTANCE  ${advisory.id}  ${advisory.package}  review was due ${entry.reviewBy}\n` +
      `  Re-check whether a patched version now exists. If it still does not, ` +
      `extend reviewBy in .audit-allowlist.json with a fresh justification.`
  );
}
for (const advisory of unaccepted) {
  console.error(
    `UNACCEPTED ADVISORY  ${advisory.id}  ${advisory.severity}  ${advisory.package}@${advisory.range}\n` +
      `  ${advisory.title}\n  ${advisory.url}\n` +
      `  Upgrade to a patched version, or add it to .audit-allowlist.json with a written justification.`
  );
}
for (const entry of stale) {
  console.log(`stale allowlist entry, advisory no longer present: ${entry.id}. Remove it.`);
}

if (unaccepted.length || expired.length) process.exit(1);

const counts = report.metadata?.vulnerabilities ?? {};
console.log(
  `Audit gate passed: ${counts.total ?? 0} advisory findings, ` +
    `${advisories.size} distinct, all accepted in .audit-allowlist.json.`
);
