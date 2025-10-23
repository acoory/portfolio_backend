FROM node:20-alpine as builder

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy source files
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /usr/src/app

# create .env file
COPY .env .env

# Copy package files and install production dependencies
COPY package*.json ./
COPY --from=builder /usr/src/app/node_modules/.prisma ./node_modules/.prisma
RUN npm ci --only=production

# Copy built application
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/prisma ./prisma

# Generate Prisma Client in production
RUN npx prisma generate

# Expose the application port
EXPOSE 3007

# Command to run the application
CMD ["node", "dist/main.js"]