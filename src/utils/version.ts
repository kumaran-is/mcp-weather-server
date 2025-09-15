/**
 * Version utility to get package version
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// Get version from package.json using CommonJS approach
const packageJsonPath = join(__dirname, '..', '..', 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

export const VERSION = packageJson.version;
export const NAME = packageJson.name;
