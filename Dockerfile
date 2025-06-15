# Multi-stage build for XLS Converter
# Stage 1: Python core service
FROM python:3.9-slim AS python-service

WORKDIR /app

# Install system dependencies and Python dependencies
RUN apt-get update && \
    apt-get install -y curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*
    
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Python service files
COPY src/server/xls-conversion-service.py ./src/server/

# Expose port used by Python service
EXPOSE 5001

# Stage 2: Node.js wrapper
FROM node:16-alpine AS node-wrapper

WORKDIR /app

# Copy package.json and install dependencies
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Copy application code
COPY . .

# Expose port used by Node.js server
EXPOSE 3000

# Start both services using a custom entrypoint script
COPY docker-entrypoint.sh .
RUN chmod +x docker-entrypoint.sh

ENTRYPOINT ["./docker-entrypoint.sh"]
