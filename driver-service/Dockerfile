# Use official Node.js runtime as base image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package manifests and install dependencies
COPY package*.json ./
RUN npm install

# Copy Prisma files and generate client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy application code
COPY . . 

# Expose port
EXPOSE 3002

# Start application
CMD ["npm", "start"]
