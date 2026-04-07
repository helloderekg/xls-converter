# syntax=docker/dockerfile:1.6
#
# Zero-CVE multi-stage build using Chainguard Wolfi as the base.
# Wolfi packages are continuously rebuilt against the latest CVE fixes,
# so the runtime image starts (and stays) at 0 CVEs across CRITICAL/HIGH/MED/LOW.
#
# App layout:
#   - test-server.js (Node/Express): API gateway, talks to the Python service
#   - src/server/xls-conversion-service.py (Flask): does the actual XLS work
#   - src/client/ (static HTML/CSS/JS): served by Python's built-in http.server


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
      org.opencontainers.image.description="Zero-CVE XLS/XLSX converter (Python + Node, Wolfi base)" \
      org.opencontainers.image.vendor="XLS Converter" \
      org.opencontainers.image.version="1.2.0" \
      org.opencontainers.image.source="https://github.com/helloderekg/xls-converter"

USER root
WORKDIR /app

# Runtime-only packages — no build tools, no npm, no curl.
# - python + pip: runs the Flask conversion service AND serves the static client
#   via `python -m http.server`
# - nodejs: runs test-server.js
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
COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir --break-system-packages -r /tmp/requirements.txt && \
    rm /tmp/requirements.txt

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
