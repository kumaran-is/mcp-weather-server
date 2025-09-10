# Docker Deployment Guide

This guide explains how to deploy the MCP Weather Server using Docker and Docker Compose.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Configuration](#configuration)
3. [Development Deployment](#development-deployment)
4. [Production Deployment](#production-deployment)
5. [Environment Variables](#environment-variables)
6. [Docker Best Practices](#docker-best-practices)
7. [Troubleshooting](#troubleshooting)

## Prerequisites

- Docker 20.10+ installed
- Docker Compose 1.29+ installed
- `.env` file configured (copy from `.env.example`)

## Configuration

### Environment Files

The application uses environment variables for all configuration:

1. **`.env`** - Default environment file for development
2. **`.env.production`** - Production environment file
3. **`.env.example`** - Template with all available variables

**Important:** Never commit actual `.env` or `.env.production` files to version control.

### Key Features

✅ **No Hardcoded Values**: All configuration comes from environment variables
✅ **Flexible Port Mapping**: Port configurable via `MCP_HTTP_PORT`
✅ **Health Checks**: Built-in health monitoring
✅ **Security**: Non-root user, minimal base image
✅ **Multi-stage Build**: Optimized image size

## Development Deployment

### Quick Start

1. **Copy environment template:**
```bash
cp .env.example .env
```

2. **Edit `.env` file with your settings:**
```bash
# Key settings to update
MCP_TRANSPORT=http
MCP_HTTP_PORT=8080
NODE_ENV=development
LOG_LEVEL=debug
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080
```

3. **Build and run:**
```bash
docker-compose up --build
```

4. **Verify deployment:**
```bash
curl http://localhost:8080/health
```

### Development Commands

```bash
# Build the image
docker-compose build

# Start in background
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild and restart
docker-compose up --build --force-recreate
```

## Production Deployment

### Setup Production Environment

1. **Create production environment file:**
```bash
cp .env.production.example .env.production
```

2. **Configure production settings:**
```bash
# Edit .env.production
NODE_ENV=production
LOG_LEVEL=warn
ALLOWED_ORIGINS=https://yourdomain.com
# ... other production settings
```

3. **Deploy with production compose:**
```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Production Features

The production deployment includes:

- **Redis** for session persistence
- **Nginx** for SSL termination and reverse proxy
- **Resource limits** for container management
- **Health checks** with increased thresholds
- **Log rotation** to prevent disk filling
- **Network isolation** with custom subnet

### Production Commands

```bash
# Deploy production stack
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Scale the service
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --scale mcp-weather-server=3

# View production logs
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs -f mcp-weather-server

# Update production deployment
docker-compose -f docker-compose.yml -f docker-compose.prod.yml pull
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Clean up
docker-compose -f docker-compose.yml -f docker-compose.prod.yml down -v
```

## Environment Variables

### Essential Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Environment mode | development | Yes |
| `MCP_TRANSPORT` | Transport type (stdio/http) | stdio | Yes |
| `MCP_HTTP_PORT` | HTTP server port | 8080 | For HTTP |
| `ALLOWED_ORIGINS` | CORS allowed origins | * | For production |
| `LOG_LEVEL` | Logging level | debug | No |

### All Variables from .env

All variables defined in `.env.example` are available:

- API Configuration (`OPEN_METEO_BASE_URL`, `GEOCODING_API_URL`)
- Performance Settings (timeouts, retries)
- Connection Pool Configuration
- Circuit Breaker Settings
- Rate Limiting Configuration
- Session Management

## Docker Best Practices

### 1. Image Optimization

The Dockerfile uses multi-stage builds:
- **Builder stage**: Compiles TypeScript
- **Production stage**: Minimal runtime image
- Result: ~50% smaller image size

### 2. Security

- ✅ Non-root user (`mcpweather`)
- ✅ Alpine Linux base (minimal attack surface)
- ✅ No secrets in image
- ✅ Health checks included

### 3. Environment Variables

- All configuration via environment variables
- No hardcoded values in Dockerfile
- Support for `.env` files
- Override capability in docker-compose

### 4. Networking

- Custom bridge network
- Service discovery by name
- Isolated from host network
- Optional nginx proxy for SSL

## Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Change port in .env
MCP_HTTP_PORT=3000

# Or use different external port
docker-compose up -d
```

#### Environment Variables Not Loading
```bash
# Verify .env file exists
ls -la .env

# Check environment in container
docker-compose exec mcp-weather-server env | grep MCP
```

#### Container Fails Health Check
```bash
# Check logs
docker-compose logs mcp-weather-server

# Test health endpoint manually
docker-compose exec mcp-weather-server curl localhost:8080/health
```

#### Permission Issues
```bash
# Rebuild with proper permissions
docker-compose build --no-cache
```

### Debug Mode

Enable debug logging:
```bash
# In .env
LOG_LEVEL=debug
DEBUG=true

# Restart
docker-compose restart
```

### Container Shell Access
```bash
# Access running container
docker-compose exec mcp-weather-server sh

# Run with shell for debugging
docker run -it --rm mcp-weather-server sh
```

## Docker Hub Deployment

### Build and Push to Registry

```bash
# Build production image
docker build -t yourusername/mcp-weather-server:latest .

# Tag version
docker tag yourusername/mcp-weather-server:latest yourusername/mcp-weather-server:1.0.0

# Push to registry
docker push yourusername/mcp-weather-server:latest
docker push yourusername/mcp-weather-server:1.0.0
```

### Deploy from Registry

```bash
# Pull latest
docker pull yourusername/mcp-weather-server:latest

# Run with env file
docker run -d \
  --name mcp-weather \
  --env-file .env.production \
  -p 8080:8080 \
  yourusername/mcp-weather-server:latest
```

## Kubernetes Deployment

For Kubernetes deployment, use environment variables from ConfigMaps and Secrets:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: mcp-weather-config
data:
  NODE_ENV: "production"
  MCP_TRANSPORT: "http"
  MCP_HTTP_PORT: "8080"
  LOG_LEVEL: "warn"
---
apiVersion: v1
kind: Secret
metadata:
  name: mcp-weather-secrets
type: Opaque
data:
  ALLOWED_ORIGINS: <base64-encoded-value>
```

## Summary

The Docker deployment is fully configured through environment variables with:
- ✅ No hardcoded values
- ✅ Production-ready configuration
- ✅ Security best practices
- ✅ Health monitoring
- ✅ Flexible deployment options

All configuration is driven by `.env` files, making it easy to deploy in any environment without modifying code or Docker files.