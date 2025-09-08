# MCP Weather Server Dockerfile
# Multi-stage build for production deployment

# Build stage
FROM node:22-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for building)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:22-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S mcpweather -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy environment file template
COPY .env.example .env

# Change ownership to non-root user
RUN chown -R mcpweather:nodejs /app
USER mcpweather

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (res) => { \
    process.exit(res.statusCode === 200 ? 0 : 1) \
  }).on('error', () => process.exit(1))"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Default command
CMD ["npm", "start"]

# Labels for metadata
LABEL org.opencontainers.image.title="MCP Weather Server" \
      org.opencontainers.image.description="Model Context Protocol server for weather information using Open-Meteo API" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.authors="MCP Weather Server Team" \
      org.opencontainers.image.source="https://github.com/kumaran-is/mcp-weather-server" \
      org.opencontainers.image.licenses="MIT"
