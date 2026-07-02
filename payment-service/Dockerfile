# Use official Node.js runtime as base image
FROM node:20-alpine

# Set working directory
WORKDIR /app

COPY package*.json ./
RUN npm install
RUN npx prisma generate

# Copy application code
COPY . . 

# Expose port
EXPOSE 3004

# Start application
CMD ["npm", "start"]
