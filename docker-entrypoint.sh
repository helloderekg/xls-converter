#!/bin/sh
# Start the Python conversion service in the background
echo "Starting Python XLS Conversion Service..."
python /app/src/server/xls-conversion-service.py &

# Give the Python service a moment to initialize
sleep 2

# Start the Node.js server in the foreground
echo "Starting Node.js wrapper service..."
cd /app && node src/server/index.js

# Note: The container will stay alive as long as the Node.js server is running.
# If Node.js exits, the container will exit even if the Python service is still running.
