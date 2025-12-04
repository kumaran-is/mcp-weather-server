/**
 * Version utility to get package version
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get version from package.json
const packageJsonPath = join(__dirname, '..', '..', 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

export const VERSION = packageJson.version;
export const NAME = packageJson.name;
export const DESCRIPTION = packageJson.description || 'MCP Weather Server';

/**
 * Get server info for MCP initialization
 */
export function getServerInfo() {
  return {
    name: NAME,
    version: VERSION,
  };
}
