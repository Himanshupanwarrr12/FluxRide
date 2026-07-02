# Use official Node.js runtime as base image
FROM node:20-alpine

# Set working directory
WORKDIR /app

COPY package*.json ./
RUN npm install

# Copy application code
COPY . . 

# Expose port
EXPOSE 3005

# Start application
CMD ["npm", "start"]
