#!/bin/sh
set -e

echo "======================================================================="
echo "Starting XLS to XLSX Converter Application"
echo "======================================================================="

# Create required directories if they don't exist
mkdir -p /app/uploads /app/output /app/temp

# 1. Start the test server in the background
echo "\n[1/3] Starting test server on port $PORT..."
node /app/test-server.js &
TEST_SERVER_PID=$!

# Give the server a moment to initialize
sleep 2
echo "Test server started with PID $TEST_SERVER_PID"

# 2. Start the Python conversion service in the background
echo "\n[2/3] Starting Python XLS Conversion Service on port $PYTHON_SERVICE_PORT..."
python /app/src/server/xls-conversion-service.py &
PYTHON_SERVICE_PID=$!

# Give the Python service a moment to initialize
sleep 2
echo "Python service started with PID $PYTHON_SERVICE_PID"

# 3. Start the client server in the foreground
echo "\n[3/3] Starting client web interface on port $CLIENT_PORT..."
cd /app && npx serve src/client -l $CLIENT_PORT

# Note: If client server exits, we should clean up the background processes
trap "kill $TEST_SERVER_PID $PYTHON_SERVICE_PID" EXIT
