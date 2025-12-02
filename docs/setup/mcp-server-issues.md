# MCP Server Setup Issues & Resolutions

**Last Updated**: 2025-12-02  
**Status**: PARTIAL - Hurricane Tracker working, Weather MCP needs fix

---

## Summary

| MCP Server | Port | Status | Issue |
|------------|------|--------|-------|
| Hurricane Tracker MCP | 8081 | ✅ HEALTHY | None - working perfectly |
| Weather MCP Server | 8080 | ❌ RESTARTING | stdio import error (see below) |

---

## Issue 1: Weather MCP Server - stdio Import Error

### Problem
Weather MCP Server fails to start in Docker container with error:
```
Error: Cannot find module '/app/node_modules/@modelcontextprotocol/sdk/dist/cjs/server/stdio'
```

### Environment
- Docker Image: node:22-alpine
- Transport: HTTP (configured in docker-compose.yml)
- Container: mcp-weather-server-mcp-weather-server-1
- Port: 8080

### Steps Taken
1. ✅ Created .env file from .env.example
2. ✅ Changed MCP_TRANSPORT=stdio to MCP_TRANSPORT=http
3. ✅ Rebuilt Docker container with docker-compose up --build -d
4. ❌ Still fails - server tries to import stdio module

### Root Cause Analysis
The compiled code has hardcoded imports resolved at build time, not runtime.

### Workaround
Proceed with Hurricane Tracker MCP only (port 8081) which is fully operational.

---

## Success: Hurricane Tracker MCP Setup

**Location**: hurricane-tracker-mcp/

**docker-compose.yml modification**:
- Changed port mapping to "8081:8080" to avoid conflict with Weather MCP

**Setup Commands**:
```bash
cd hurricane-tracker-mcp
npm install  # Generated package-lock.json
docker-compose up --build -d
```

**Status**: Container healthy on port 8081

**Project .env updated**:
```bash
MCP_HURRICANE_SERVER_URL=http://localhost:8081
MCP_HURRICANE_SERVER_ENABLED=true
```

---

## References
- Hurricane Tracker MCP: https://github.com/kumaran-is/hurricane-tracker-mcp
- Level 0 Plan: docs/plan/level-0-plan.md (Phase 5)
