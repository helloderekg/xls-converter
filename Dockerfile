# Use Python 3.12 as the base image for XLS Converter
FROM python:3.12-slim

WORKDIR /app

# Install Node.js 20
RUN apt-get update && \
    apt-get install -y curl gnupg build-essential && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    pip --version && python --version && node --version && npm --version
    
# Install Python dependencies with careful attention to binary compatibility
COPY requirements.txt .
RUN pip install --upgrade pip setuptools wheel && \
    pip install --no-cache-dir numpy==1.26.0 && \
    pip install --no-cache-dir -r requirements.txt && \
    # Verify installed versions
    pip list | grep -E "numpy|pandas|xlrd|openpyxl|Flask"

# Install Node.js dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p /app/uploads /app/output /app/temp

# Expose ports for test-server, Python service, and client
EXPOSE 4040 5001 4001

# Set environment variables
ENV PORT=4040
ENV PYTHON_SERVICE_PORT=5001
ENV CLIENT_PORT=4001
ENV NODE_ENV=production

# Make entrypoint script executable
RUN chmod +x docker-entrypoint.sh

ENTRYPOINT ["/bin/sh", "./docker-entrypoint.sh"]
