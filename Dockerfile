# Stage 1: Build the frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Production server
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production

# Install production dependencies only
COPY package*.json ./
RUN npm install --omit=dev

# Copy built frontend from Stage 1
COPY --from=frontend-builder /app/dist ./dist

# Copy server source (since we use tsx or node with ESM)
COPY server.ts ./
COPY .env.example ./.env.example

# Expose the port
EXPOSE 3000

# Start the server
CMD ["npm", "start"]
