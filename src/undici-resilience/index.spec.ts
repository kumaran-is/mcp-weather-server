import { describe, it, expect, vi, beforeEach } from 'vitest';
import { poolManager } from './index';
import { PoolManager } from './http/pool-manager';

// Mock the PoolManager
vi.mock('./http/pool-manager.js', () => {
  const MockPoolManager = vi.fn();
  MockPoolManager.prototype.request = vi.fn();
  MockPoolManager.prototype.getPool = vi.fn();
  MockPoolManager.prototype.closeAll = vi.fn();
  MockPoolManager.prototype.getMetrics = vi.fn();
  return { PoolManager: MockPoolManager };
});

describe('undici-resilience index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export poolManager instance', () => {
    expect(poolManager).toBeDefined();
    expect(poolManager).toBeInstanceOf(PoolManager);
  });

  it('should create PoolManager with singleton pattern', () => {
    const { poolManager: poolManager2 } = require('./index.js');
    expect(poolManager).toBe(poolManager2);
  });

  it('should expose request method', () => {
    expect(typeof poolManager.request).toBe('function');
  });

  it('should expose getPool method', () => {
    expect(typeof poolManager.getPool).toBe('function');
  });

  it('should expose closeAll method', () => {
    expect(typeof poolManager.closeAll).toBe('function');
  });

  it('should expose getMetrics method', () => {
    expect(typeof poolManager.getMetrics).toBe('function');
  });

  it('should forward request calls to PoolManager', async () => {
    const mockResponse = { data: 'test' };
    poolManager.request.mockResolvedValue(mockResponse);

    const result = await poolManager.request('test-pool', { path: '/test' });
    
    expect(result).toBe(mockResponse);
    expect(poolManager.request).toHaveBeenCalledWith('test-pool', { path: '/test' });
  });

  it('should forward getPool calls to PoolManager', () => {
    const mockPool = { id: 'test-pool' };
    poolManager.getPool.mockReturnValue(mockPool);

    const result = poolManager.getPool('test-pool');
    
    expect(result).toBe(mockPool);
    expect(poolManager.getPool).toHaveBeenCalledWith('test-pool');
  });

  it('should forward closeAll calls to PoolManager', async () => {
    await poolManager.closeAll();
    
    expect(poolManager.closeAll).toHaveBeenCalled();
  });

  it('should forward getMetrics calls to PoolManager', () => {
    const mockMetrics = { requests: 100 };
    poolManager.getMetrics.mockReturnValue(mockMetrics);

    const result = poolManager.getMetrics();
    
    expect(result).toBe(mockMetrics);
    expect(poolManager.getMetrics).toHaveBeenCalled();
  });
});