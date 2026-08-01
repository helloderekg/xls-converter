# syntax=docker/dockerfile:1.6
#
# Multi-stage build on Chainguard Wolfi. Wolfi rebuilds its packages against
# current CVE fixes, so a FRESH build starts clean — but a published tag does
# not stay clean on its own. The 1.2.1 image scanned clean on 2026-04-07 and
# reported 148 findings by 2026-07-31 with nothing changed. Rebuild and
# republish on a schedule; CI does that weekly.
#
# App layout:
#   - src/server/index.js (Node/Express): API gateway, talks to the Python service
#   - src/server/xls-conversion-service.py (Flask): does the actual conversion
#   - src/client/ (static HTML/CSS/JS): served by Python's built-in http.server
#   - docker-entrypoint.sh starts all three


# ---------- Stage 1: build ----------
FROM cgr.dev/chainguard/wolfi-base:latest AS build

USER root
WORKDIR /app

# Build-time toolchain. Wolfi packages are nightly-rebuilt, so we just take latest.
RUN apk update && \
    apk add --no-cache \
        python-3.13 \
        py3.13-pip \
        nodejs-22 \
        npm \
        build-base

# Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir --break-system-packages --upgrade pip setuptools wheel && \
    pip install --no-cache-dir --break-system-packages -r requirements.txt

# Node deps. .dockerignore strips package-lock.json so the lockfile is regenerated
# fresh against the current overrides in package.json — that prevents Docker Scout
# from flagging stale lockfile entries.
COPY package.json ./
RUN npm cache clean --force && \
    npm install --omit=dev --no-audit --no-fund && \
    npm ls form-data minimatch glob picomatch jws path-to-regexp brace-expansion qs 2>&1 || true

# App code
COPY . .
RUN mkdir -p /app/uploads /app/output /app/temp


# ---------- Stage 2: runtime ----------
FROM cgr.dev/chainguard/wolfi-base:latest

LABEL org.opencontainers.image.title="XLS Converter" \
      org.opencontainers.image.description="XLS/XLSX/CSV/ODS/JSON to XLSX converter (Python + Node, Wolfi base)" \
      org.opencontainers.image.vendor="XLS Converter" \
      org.opencontainers.image.version="1.2.3" \
      org.opencontainers.image.source="https://github.com/helloderekg/xls-converter"

USER root
WORKDIR /app

# Runtime-only packages — no build tools, no npm, no curl.
# - python + pip: runs the Flask conversion service AND serves the static client
#   via `python -m http.server`
# - nodejs: runs src/server/index.js
# - busybox provides wget, used for the HEALTHCHECK
RUN apk update && apk upgrade --no-cache && \
    apk add --no-cache \
        python-3.13 \
        py3.13-pip \
        nodejs-22 \
        busybox && \
    addgroup -S appuser && adduser -S -G appuser appuser

# Install Python runtime deps directly (don't copy site-packages from build —
# the build stage installed them under a different python path inside its layer).
#
# pip and setuptools are then removed in the same layer. Nothing at runtime uses
# them, and pip ships a vendored-dependency SBOM (pip/_vendor/bom.cdx.json) that
# scanners read as installed packages — that file alone accounted for the
# msgpack 1.1.2 and setuptools 70.3.0 findings, neither of which was a package
# this image actually imports. Dropping pip removes the finding and the attack
# surface together.
COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir --break-system-packages -r /tmp/requirements.txt && \
    rm /tmp/requirements.txt && \
    apk del py3.13-pip py3.13-pip-base py3-pip-wheel py3.13-setuptools 2>/dev/null || true && \
    rm -rf /usr/lib/python3.13/site-packages/pip \
           /usr/lib/python3.13/site-packages/pip-*.dist-info \
           /usr/lib/python3.13/site-packages/setuptools \
           /usr/lib/python3.13/site-packages/setuptools-*.dist-info \
           /usr/lib/python3.13/site-packages/pkg_resources \
           /root/.cache/pip

# Bring in the app + node_modules from the build stage
COPY --from=build /app /app

RUN chown -R appuser:appuser /app && \
    chmod +x /app/docker-entrypoint.sh

USER appuser

EXPOSE 4040 5001 4001

ENV PORT=4040 \
    PYTHON_SERVICE_PORT=5001 \
    CLIENT_PORT=4001 \
    NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:4040/health || exit 1

ENTRYPOINT ["/bin/sh", "/app/docker-entrypoint.sh"]
