import { describe, it, expect } from 'vitest';
import { VERSION, NAME } from './version';

describe('Version Utils', () => {
  describe('VERSION constant', () => {
    it('should export a version string', () => {
      expect(VERSION).toBeDefined();
      expect(typeof VERSION).toBe('string');
      expect(VERSION.length).toBeGreaterThan(0);
    });

    it('should follow semantic versioning pattern', () => {
      // VERSION should match pattern like 1.0.0, 0.1.0-beta, etc.
      const semverPattern = /^\d+\.\d+\.\d+(-\w+)*$/;
      expect(VERSION).toMatch(semverPattern);
    });

    it('should not be empty or whitespace', () => {
      expect(VERSION.trim()).toBe(VERSION);
      expect(VERSION.trim().length).toBeGreaterThan(0);
    });
  });

  describe('NAME constant', () => {
    it('should export a name string', () => {
      expect(NAME).toBeDefined();
      expect(typeof NAME).toBe('string');
      expect(NAME.length).toBeGreaterThan(0);
    });

    it('should be a valid package name', () => {
      // Should not contain spaces and should be lowercase with hyphens
      expect(NAME).not.toContain(' ');
      expect(NAME).toBe(NAME.toLowerCase());
    });

    it('should not be empty or whitespace', () => {
      expect(NAME.trim()).toBe(NAME);
      expect(NAME.trim().length).toBeGreaterThan(0);
    });

    it('should contain weather-related terms', () => {
      const lowerName = NAME.toLowerCase();
      const hasWeather = lowerName.includes('weather') ||
                        lowerName.includes('mcp') ||
                        lowerName.includes('server');
      expect(hasWeather).toBe(true);
    });
  });

  describe('Constants consistency', () => {
    it('should have consistent naming convention', () => {
      // Both constants should be strings and non-empty
      expect(typeof VERSION).toBe('string');
      expect(typeof NAME).toBe('string');
      expect(VERSION.length).toBeGreaterThan(0);
      expect(NAME.length).toBeGreaterThan(0);
    });
  });
});
