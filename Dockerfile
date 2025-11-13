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

# Install Python dependencies in virtual environment (BUILD TIME - not runtime)
# This installs all packages: opencv-python, pytesseract, Pillow, numpy, img2pdf, rembg
RUN /app/venv/bin/pip install --upgrade pip && \
    /app/venv/bin/pip install --no-cache-dir -r scripts/requirements.txt

# Verify all packages are installed correctly
RUN /app/venv/bin/python3 -c "import cv2; import pytesseract; from PIL import Image; import numpy as np; import img2pdf; from rembg import remove; print('✅ All Python packages installed successfully')"

# Pre-download all rembg models to avoid downloading during runtime (prevents OOM)
# This downloads all models during build time so they're cached in the Docker image
RUN /app/venv/bin/python3 scripts/preload_rembg_models.py

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

