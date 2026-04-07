#!/bin/sh
set -e

echo "======================================================================="
echo "Starting XLS to XLSX Converter Application"
echo "======================================================================="

# Runtime directories (mounted volumes win if they're attached, otherwise
# we create empty ones inside the image so multer/Flask have somewhere
# to write).
mkdir -p /app/uploads /app/output /app/temp

# 1. Python conversion service (the actual XLS engine, internal)
echo
echo "[1/3] Starting Python XLS Conversion Service on port ${PYTHON_SERVICE_PORT}..."
python /app/src/server/xls-conversion-service.py &
PYTHON_PID=$!
echo "      pid=${PYTHON_PID}"

# Give Flask a moment to bind before Node tries to talk to it.
sleep 2

# 2. Node API gateway (the public-facing /convert endpoint)
echo
echo "[2/3] Starting Node API gateway on port ${PORT}..."
node /app/src/server/index.js &
NODE_PID=$!
echo "      pid=${NODE_PID}"

# 3. Static web client (Python's built-in http.server — no extra deps)
echo
echo "[3/3] Starting static web client on port ${CLIENT_PORT}..."
cd /app && exec python -m http.server "${CLIENT_PORT}" --directory src/client --bind 0.0.0.0

# (exec replaces this shell, so the trap below only matters if the exec fails)
trap "kill ${PYTHON_PID} ${NODE_PID} 2>/dev/null || true" EXIT INT TERM
