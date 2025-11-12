# Use Node.js base image
FROM node:20-slim

# Install Python 3 and system dependencies for OpenCV and Tesseract
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    python3-dev \
    tesseract-ocr \
    libtesseract-dev \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all Node.js dependencies (including devDependencies for build)
RUN npm ci

# Create Python virtual environment
RUN python3 -m venv /app/venv

# Copy Python requirements and script
COPY scripts/ ./scripts/

# Install Python dependencies in virtual environment
RUN /app/venv/bin/pip install --upgrade pip && \
    /app/venv/bin/pip install --no-cache-dir -r scripts/requirements.txt

# Copy application code
COPY . .

# Build the application
RUN npm run build

# Remove devDependencies to reduce image size (optional)
RUN npm prune --production

# Expose port
EXPOSE 3030

# Start the application
CMD ["node", "dist/apps/api/main.js"]

