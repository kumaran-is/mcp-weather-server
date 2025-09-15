/**
 * Version utility to get package version
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// Get version from package.json using CommonJS __dirname
const packageJson = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8'));

export const VERSION = packageJson.version;
export const NAME = packageJson.name;
