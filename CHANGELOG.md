# Changelog

All notable changes to `xls-to-xlsx` are documented here. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this
project uses [Semantic Versioning](https://semver.org/).

## [1.2.1] - 2026-04-06

### Changed
- **Renamed npm package** from `xlsx-converter` to `xls-to-xlsx`. The
  previous name was already taken on the npm registry by an unrelated
  package; `xls-to-xlsx` is the more accurate name anyway (the project's
  whole reason to exist is converting legacy XLS into modern XLSX).
- Updated all `import` examples in the README, `docs/api.md`,
  `docs/usage.md`, `docs/browser.md`, and the inline comments in
  `src/index.js` and `src/client/sdk.js`.
- Bumped the Docker image tag to `derekgsayshi/xls-converter:1.2.1` (the
  *image* name on Docker Hub stays `xls-converter`; only the *npm package*
  was renamed).

### Fixed
- The footer link in `src/client/index.html` pointed at
  `https://github.com/helloderekg/xlsx-converter` (the wrong repo name —
  actual repo is `xls-converter`). Fixed to point at the real repo.

## [1.2.0] - 2026-04-06

### Added
- **npm package shape.** `xlsx-converter` is now publishable to npm as a
  proper library:
  - new top-level entry point [`src/index.js`](src/index.js) with a clean
    public API,
  - `package.json` `exports`, `files`, `engines`, and `repository` fields,
  - new `XlsConverterClient` SDK in [`src/client/sdk.js`](src/client/sdk.js)
    that talks to a running converter service from Node 18+ or browsers.
- **CHANGELOG.md** (this file).

### Changed
- **Single canonical Node server.** The drifting `test-server.js` (which had
  a dead `createExcelFile()` reference and a never-populated download URL
  map) was deleted. Both local dev and the Docker image now run
  [`src/server/index.js`](src/server/index.js).
- **Unified JWT secret env var.** The Node side previously read
  `JWT_SECRET_KEY` while the Python side read `SECRET_KEY` — same default,
  so it appeared to work, but any production deployment that set a custom
  secret would silently fail JWT verification. Both sides now read
  `SECRET_KEY`.
- **`REQUIRE_AUTH` is now optional and defaults to `false`** so the bundled
  web demo works out of the box. Set `REQUIRE_AUTH=true` to require a
  Bearer JWT for `POST /convert`.
- **Simplified `start-services.js`** — dropped 100+ lines of port-fallback,
  keep-alive, and reassignment logic that nothing actually used.
- **Simplified `docker-entrypoint.sh`** to launch the canonical Node server
  and use `exec` for the foreground process so signals propagate cleanly.
- Pruned `package.json` `overrides` from ~30 historical entries down to the
  ~10 that are actually load-bearing for current scanners.
- Bumped `engines.node` to `>=18` (we rely on the global `fetch` and modern
  ESM resolution).

### Removed
- `test-server.js` — replaced by `src/server/index.js` (consolidation).
- `examples/` directory — was a near-duplicate of `src/client/` and the
  `examples/node/` and `examples/browser/` paths referenced by the old
  testing checklist never existed.
- `TESTING_CHECKLIST.md` — referenced files that didn't exist; replace with
  `CHANGELOG.md` and the test suite under `test/`.

### Fixed
- Dead `createExcelFile()` reference in the old `test-server.js` could
  500 any client that hit the `/download/:filename` fallback path.
- Mismatched JWT env var names between Node and Python (see *Changed*).

---

## [1.1.0] - 2026-04-06

### Added
- **Zero-CVE Docker image** based on `cgr.dev/chainguard/wolfi-base`.
  `docker scout cves derekgsayshi/xls-converter:1.1.0` reports
  `0C / 0H / 0M / 0L` across all 307 indexed packages.
- Multi-stage Dockerfile (`build` + minimal runtime).
- Non-root `appuser` in the runtime image.
- New npm scripts: `docker:build`, `docker:run`, `docker:scan`.

### Changed
- Replaced the old ~330-line Dockerfile (which installed Go to "patch" Go
  CVEs that wouldn't have existed if Go weren't installed, plus dozens of
  shell heredocs and fake SBOM files) with an ~85-line Wolfi-based build.
- Replaced `npx serve src/client` in the entrypoint with Python's built-in
  `http.server` so the runtime image doesn't need `npm`.
- Replaced the `curl` healthcheck with `wget` (busybox) to avoid Alpine's
  unfixed CVE-2026-3805.
- Bumped `multer` 2.0.1 → 2.1.1, `form-data` 4.0.3 → 4.0.4,
  `PyJWT` 2.8.0 → 2.12.0.
- Added overrides for `qs`, `path-to-regexp`, `jws`, `glob`, `minimatch`,
  `picomatch`, `brace-expansion`, `@isaacs/brace-expansion`, `tar` to pull
  in CVE-fixed versions.

### Removed
- `.yarnrc.yml` (yarn config in an npm-only project).
- `docker-compose.yml` (was broken — referenced non-existent `target:`
  build stages and bundled an unrelated clamav service).
- `docs/vulnerability-remediation.md` (entirely about a brace-expansion
  CVE saga that no longer applies).
- The convoluted "install Go to patch Go CVEs" code path from the
  Dockerfile.

### Fixed
- Stale `package-lock.json` was being copied into the image via `COPY . .`,
  overwriting the freshly-generated one and causing scanners to report
  stale resolved versions. The lockfile is now excluded via `.dockerignore`
  and regenerated against the current `overrides` during the build.

---

## [1.0.0] - 2025-06-16

Initial public release.
