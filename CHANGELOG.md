# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Health check endpoint (`/health`) for HTTP transport monitoring
- Session management for HTTP transport with automatic cleanup
- Express.js integration for robust HTTP server implementation
- DNS rebinding protection controls for development environments
- Graceful shutdown handling for HTTP transport with session cleanup

### Changed
- Updated MCP endpoint paths from `/` to `/mcp` for HTTP transport
- Updated `@modelcontextprotocol/sdk` from `^1.0.0` to `^1.17.5`
- Improved HTTP transport implementation with proper session handling
- Enhanced error handling for invalid session IDs and malformed requests
- Updated Cline integration documentation with correct endpoint URLs

### Fixed
- MCP endpoint URL configuration in integration documentation
- Session ID validation and transport reuse logic
- HTTP transport lifecycle management and cleanup

### Dependencies
- Updated `@modelcontextprotocol/sdk`: `^1.0.0` → `^1.17.5`
- Added `@types/express`: `^5.0.3` (dev dependency)
- Added `@types/long`: `~4.0.2` (dev dependency)

## [1.0.0] - 2025-01-08

### Added
- Initial release of MCP Weather Server
- Open-Meteo weather API integration with comprehensive weather data
- Support for multiple MCP transports:
  - Stdio transport for local AI assistants (Cline, Claude Desktop)
  - Streamable HTTP transport for remote connections
  - Custom WebSocket transport support
- Weather tools:
  - `get_current_weather`: Get current weather conditions for a location
  - `get_weather_forecast`: Get weather forecast for up to 7 days
  - `get_weather_alerts`: Get active weather alerts for a region
- TypeScript 5.8+ implementation with strict typing
- Node.js 22.x compatibility
- Comprehensive error handling and logging with Pino
- Environment-based configuration
- Unit and integration tests with Jest
- Docker support for containerized deployment
- ESM module system
- JSON-RPC 2.0 compliance with MCP specification 2025-06-18
- Security features: input validation, HTTPS support, Origin validation
- Performance optimizations: caching, event-driven architecture

### Dependencies
- `@modelcontextprotocol/sdk`: ^1.0.0
- `uuid`: ^9.0.1
- `dotenv`: ^16.4.1
- `pino`: ^8.15.0
- `node-fetch`: ^3.3.2

### Dev Dependencies
- `typescript`: ^5.8.0
- `tsx`: ^4.7.0
- `jest`: ^29.7.0
- `@types/node`: ^22.0.0
- `@types/uuid`: ^9.0.7
- `@types/jest`: ^29.5.5
- `ts-jest`: ^29.1.1

### Features
- Modular architecture with separate concerns for services, protocol handlers, and transports
- Extensible design supporting future RAG and AI agent workflow integrations
- Comprehensive documentation and examples
- Production-ready with proper lifecycle management and capability negotiation

### Security
- Input validation and sanitization
- HTTPS/WSS support for secure connections
- Localhost binding for development
- Environment variable configuration for sensitive data

### Performance
- Optimized for low-latency responses
- Event-driven concurrency patterns
- Efficient API rate limiting and caching
- Node.js performance profiling support

---

## Types of changes
- `Added` for new features
- `Changed` for changes in existing functionality
- `Deprecated` for soon-to-be removed features
- `Removed` for now removed features
- `Fixed` for any bug fixes
- `Security` in case of vulnerabilities

## Contributing
When contributing to this project, please update the CHANGELOG.md file with your changes under the [Unreleased] section at the top of the file.

## Version History
- 1.0.0: Initial stable release with full MCP compliance and weather API integration
