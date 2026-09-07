// Weekly self-heal for the dependency audit.
//
// The Monday audit fails whenever an advisory is published against a locked
// version, which is to say against code nobody changed. On 2026-09-07 that was
// 30 repos red on one sanitize-html advisory. This script moves each flagged
// package to the lowest patched release that has been on the registry for at
// least MIN_AGE_HOURS (48h, the portfolio's Tier 1 hold for security patches),
// never crossing a major version, then re-runs the repo's own gate. It exits 0
// only when the gate passes; the workflow commits the result on that exit code.
//
// What it will not do, on purpose:
//   - cross a major version (npm audit's fixAvailable.isSemVerMajor)
//   - take a release younger than MIN_AGE_HOURS, even if it is the only fix
//   - add an override for a package installed at more than one major, because
//     one override would drag every consumer onto one version
// Each of those is reported and left for a person.
//
// Usage:  node scripts/audit-heal.mjs [dir ...]      (default ".")
// Env:    AUDIT_GATE      gate command run in each dir   (default "npm run audit:high")
//         MIN_AGE_HOURS   release-age floor              (default 48)
//         HEAL_OUT_DIR    when set, writes report.md and commit.txt there

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

const require = createRequire(import.meta.url);
const win = process.platform === "win32";

function loadSemver() {
  // npm bundles semver; this is the one dependency the script needs and the one
  // copy guaranteed to exist wherever npm does.
  const globalRoot = execFileSync(win ? "npm.cmd" : "npm", ["root", "-g"], {
    encoding: "utf8",
    shell: win,
  }).trim();
  for (const candidate of [join(globalRoot, "npm", "node_modules", "semver"), "semver"]) {
    try {
      return require(candidate);
    } catch (err) {
      if (err.code !== "MODULE_NOT_FOUND") throw err;
    }
  }
  throw new Error("audit-heal: no semver module found (looked in npm's bundle and the local tree)");
}
const semver = loadSemver();

const dirs = process.argv.slice(2).length ? process.argv.slice(2) : ["."];
const GATE = process.env.AUDIT_GATE || "npm run audit:high";
const MIN_AGE_HOURS = Number(process.env.MIN_AGE_HOURS || 48);
const cutoff = new Date(Date.now() - MIN_AGE_HOURS * 3600 * 1000);
const cutoffISO = cutoff.toISOString();
const MAX_PASSES = 3;

function npm(args, cwd, { allowFail = false } = {}) {
  const r = spawnSync(win ? "npm.cmd" : "npm", args, {
    cwd,
    encoding: "utf8",
    shell: win,
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, npm_config_fund: "false", npm_config_audit: "false" },
  });
  if (r.status !== 0 && !allowFail) {
    throw new Error(`npm ${args.join(" ")} failed in ${cwd}:\n${r.stderr || r.stdout}`);
  }
  return r;
}

function auditJson(cwd) {
  // npm audit exits 1 whenever it finds anything; the JSON is still on stdout.
  const r = npm(["audit", "--json"], cwd, { allowFail: true });
  const text = r.stdout.trim();
  if (!text) throw new Error(`npm audit --json printed nothing in ${cwd}:\n${r.stderr}`);
  const json = JSON.parse(text);
  if (json.error) throw new Error(`npm audit failed in ${cwd}: ${JSON.stringify(json.error)}`);
  return json;
}

const registryCache = new Map();
function registryInfo(name) {
  if (!registryCache.has(name)) {
    const r = npm(["view", name, "versions", "time", "--json"], process.cwd());
    const j = JSON.parse(r.stdout);
    // npm view collapses a single-version package's `versions` to a bare string.
    registryCache.set(name, { versions: [].concat(j.versions || []), time: j.time || {} });
  }
  return registryCache.get(name);
}

function oldEnough(name, version) {
  const t = registryInfo(name).time[version];
  return Boolean(t) && new Date(t) <= cutoff;
}

// Lowest release above `current`, same major, outside every vulnerable range,
// not a prerelease, and old enough. Null when no such release exists.
function pickTarget(name, current, vulnerableRanges) {
  const { versions } = registryInfo(name);
  const major = semver.major(current);
  const ok = versions
    .filter((v) => semver.valid(v) && !semver.prerelease(v))
    .filter((v) => semver.major(v) === major && semver.gt(v, current))
    .filter((v) => !vulnerableRanges.some((r) => semver.satisfies(v, r)))
    .sort(semver.compare);
  const aged = ok.find((v) => oldEnough(name, v));
  return { target: aged || null, youngestFix: ok[0] || null };
}

function installedVersions(lock, name) {
  const suffix = `node_modules/${name}`;
  const out = new Set();
  for (const [path, entry] of Object.entries(lock.packages || {})) {
    if (path === suffix || path.endsWith(`/${suffix}`)) out.add(entry.version);
  }
  return [...out];
}

function readJson(p) {
  return JSON.parse(readFileSync(p, "utf8"));
}
function writeJson(p, obj) {
  writeFileSync(p, JSON.stringify(obj, null, 2) + "\n");
}

function specFor(oldSpec, target) {
  // Keep the author's pinning style: an exact pin stays exact, a caret stays a caret.
  if (/^[~^]/.test(oldSpec)) return oldSpec[0] + target;
  return target;
}

function healDir(dir) {
  const cwd = resolve(dir);
  const changes = [];
  const blocked = [];
  const seen = new Set();

  for (let pass = 1; pass <= MAX_PASSES; pass++) {
    const audit = auditJson(cwd);
    const vulns = Object.entries(audit.vulnerabilities || {});
    if (!vulns.length) break;

    const pkgPath = join(cwd, "package.json");
    const lockPath = join(cwd, "package-lock.json");
    const pkg = readJson(pkgPath);
    const lock = readJson(lockPath);
    let pkgDirty = false;
    const updateNames = [];
    let progressed = false;

    for (const [name, v] of vulns) {
      const advisories = (v.via || []).filter((x) => typeof x === "object" && x.url);
      if (!advisories.length) continue; // only vulnerable through a dependency; the dependency's entry handles it
      const key = `${name}@${pass}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const ranges = advisories.map((a) => a.range).filter(Boolean);
      const urls = advisories.map((a) => a.url);
      const installed = installedVersions(lock, name).filter((cur) => ranges.some((r) => semver.satisfies(cur, r)));
      if (!installed.length) continue;

      if (v.fixAvailable && typeof v.fixAvailable === "object" && v.fixAvailable.isSemVerMajor) {
        blocked.push({ name, installed, reason: `fix needs a major bump of ${v.fixAvailable.name} to ${v.fixAvailable.version}`, urls });
        continue;
      }

      const deps = pkg.dependencies || {};
      const devDeps = pkg.devDependencies || {};
      const overrides = pkg.overrides || {};

      if (v.isDirect && (name in deps || name in devDeps)) {
        const cur = installed[0];
        const { target, youngestFix } = pickTarget(name, cur, ranges);
        if (!target) {
          blocked.push({ name, installed, reason: youngestFix ? `${youngestFix} is the only patched release and is younger than ${MIN_AGE_HOURS}h` : "no patched release within this major", urls });
          continue;
        }
        const table = name in deps ? deps : devDeps;
        const oldSpec = table[name];
        table[name] = specFor(oldSpec, target);
        if (name in overrides && overrides[name] !== `$${name}`) overrides[name] = `$${name}`;
        pkgDirty = true;
        progressed = true;
        changes.push({ name, from: cur, to: target, how: `${name in deps ? "dependencies" : "devDependencies"} ${oldSpec} -> ${table[name]}`, urls });
        continue;
      }

      // Transitive. One installed major: an override is safe and deterministic.
      // Several majors: only npm update, which stays inside each parent's range.
      const majors = new Set(installed.map((x) => semver.major(x)));
      if (majors.size === 1) {
        const cur = installed.sort(semver.compare)[0];
        const { target, youngestFix } = pickTarget(name, cur, ranges);
        if (!target) {
          blocked.push({ name, installed, reason: youngestFix ? `${youngestFix} is the only patched release and is younger than ${MIN_AGE_HOURS}h` : "no patched release within this major", urls });
          continue;
        }
        const existing = overrides[name];
        if (existing && typeof existing !== "string") {
          // A nested override object scopes the pin to one parent; rewriting it
          // to a flat string would widen it to every consumer.
          blocked.push({ name, installed, reason: `overrides.${name} is a nested object; adjust it by hand`, urls });
          continue;
        }
        if (!existing || !semver.satisfies(target, existing)) {
          // A caret keeps future patch releases reachable; the weekly run only ever
          // resolves it with --before, so the age floor still holds.
          pkg.overrides = { ...overrides, [name]: `^${target}` };
          pkgDirty = true;
          changes.push({ name, from: cur, to: `^${target}`, how: `overrides ${existing || "(none)"} -> ^${target}`, urls });
        } else {
          changes.push({ name, from: cur, to: `>=${target}`, how: `npm update (override ${existing} already allows it)`, urls });
        }
        updateNames.push(name);
        progressed = true;
      } else if (v.fixAvailable === true) {
        changes.push({ name, from: installed.join(", "), to: "parents' ranges", how: "npm update, several majors installed so no override", urls });
        updateNames.push(name);
        progressed = true;
      } else {
        blocked.push({ name, installed, reason: "installed at several majors and npm reports no in-range fix", urls });
      }
    }

    if (pkgDirty) writeJson(pkgPath, pkg);
    if (!progressed) break;

    // --before is the age floor for everything npm resolves here, including the
    // transitive packages that come along with a bump.
    if (pkgDirty) npm(["install", "--package-lock-only", "--ignore-scripts", `--before=${cutoffISO}`], cwd);
    if (updateNames.length) npm(["update", ...new Set(updateNames), "--package-lock-only", "--ignore-scripts", `--before=${cutoffISO}`], cwd);
  }

  // The lockfile is what CI installs from; make node_modules match it before
  // the gate runs so the gate sees the same tree the commit will carry.
  if (changes.length) npm(["ci", "--ignore-scripts"], cwd);

  const gate = spawnSync(GATE, { cwd, shell: true, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return { dir, changes, blocked, gatePassed: gate.status === 0, gateOutput: (gate.stdout || "") + (gate.stderr || "") };
}

for (const d of dirs) {
  if (!existsSync(join(resolve(d), "package-lock.json"))) {
    console.error(`audit-heal: no package-lock.json in ${d}; this script only handles npm lockfiles`);
    process.exit(2);
  }
}

const results = dirs.map(healDir);
const allPassed = results.every((r) => r.gatePassed);

const lines = [];
const commitLines = [];
for (const r of results) {
  const where = r.dir === "." ? "" : ` (${r.dir})`;
  lines.push(`### Audit heal${where}: ${r.gatePassed ? "gate passes" : "gate still failing"}`);
  for (const c of r.changes) {
    lines.push(`- ${c.name}: ${c.from} -> ${c.to} (${c.how}) ${c.urls.join(" ")}`);
    commitLines.push(`${r.dir === "." ? "" : r.dir + ": "}${c.name} ${c.from} -> ${c.to}`);
  }
  for (const b of r.blocked) lines.push(`- LEFT FOR A PERSON ${b.name} (${b.installed.join(", ")}): ${b.reason} ${b.urls.join(" ")}`);
  if (!r.changes.length && !r.blocked.length) lines.push("- nothing to change");
  if (!r.gatePassed) lines.push("", "```", r.gateOutput.trim().slice(-3000), "```");
  lines.push("");
}
const report = lines.join("\n");
console.log(report);

if (process.env.HEAL_OUT_DIR) {
  mkdirSync(process.env.HEAL_OUT_DIR, { recursive: true });
  writeFileSync(join(process.env.HEAL_OUT_DIR, "report.md"), report);
  const subject = `audit: patched ${[...new Set(results.flatMap((r) => r.changes.map((c) => c.name)))].join(", ")} (weekly self-heal)`;
  const body = [
    "",
    `Lowest patched release at least ${MIN_AGE_HOURS}h old, same major, chosen by scripts/audit-heal.mjs on ${new Date().toISOString().slice(0, 10)}.`,
    "",
    ...commitLines,
    "",
    ...[...new Set(results.flatMap((r) => r.changes.flatMap((c) => c.urls)))],
  ];
  writeFileSync(join(process.env.HEAL_OUT_DIR, "commit.txt"), subject + "\n" + body.join("\n") + "\n");
}

process.exit(allPassed ? 0 : 1);
