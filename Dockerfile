# Use the official Node.js 20 Alpine image (smaller footprint)
FROM node:20-alpine

# Set timezone to WIB
ENV TZ=Asia/Jakarta

# Set the working directory
WORKDIR /usr/src/app

# Copy package files first (leverages Docker layer caching)
COPY package*.json ./

# Install production dependencies only (faster, smaller image)
RUN npm ci --omit=dev

# Copy the rest of the application's code
COPY . .

# Create persistent data directory
RUN mkdir -p /mount/data

# Expose health check port
EXPOSE 8080

# Command to run the application
CMD ["npm", "start"]
