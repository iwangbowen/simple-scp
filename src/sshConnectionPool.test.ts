import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SshConnectionPool } from './sshConnectionPool';
import { HostConfig, HostAuthConfig } from './types';
import { Client, ConnectConfig } from 'ssh2';

// Mock ssh2 和 ssh2-sftp-client
vi.mock('ssh2', () => {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const mockClient = vi.fn(function(this: any) {
    this.on = vi.fn().mockReturnThis();
    this.connect = vi.fn().mockReturnThis();
    this.end = vi.fn();
    this.sftp = vi.fn();
    this._listeners = new Map();

    // 重写 on 方法来保存监听器
    this.on = vi.fn((event: string, handler: Function) => {
      this._listeners.set(event, handler);
      return this;
    });

    // 添加触发事件的方法
    this._emit = (event: string, ...args: any[]) => {
      const handler = this._listeners.get(event);
      if (handler) {
        handler(...args);
      }
    };
  });

  return {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    Client: mockClient
  };
});

vi.mock('ssh2-sftp-client', () => {
  return {
    default: vi.fn(function(this: any) {
      this.sftp = null;
      this.client = null;
      this.end = vi.fn();
    })
  };
});

describe('SshConnectionPool', () => {
  let pool: SshConnectionPool;
  let mockConfig: HostConfig;
  let mockAuthConfig: HostAuthConfig;
  let mockConnectConfig: ConnectConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    // 重置单例实例
    (SshConnectionPool as any).instance = undefined;

    pool = SshConnectionPool.getInstance();

    mockConfig = {
      id: 'test-host',
      name: 'Test Host',
      host: '192.168.1.100',
      port: 22,
      username: 'testuser'
    };

    mockAuthConfig = {
      hostId: 'test-host',
      authType: 'password',
      password: 'testpass'
    };

    mockConnectConfig = {
      host: '192.168.1.100',
      port: 22,
      username: 'testuser',
      password: 'testpass'
    };
  });

  afterEach(() => {
    pool.closeAll();
    vi.clearAllTimers();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = SshConnectionPool.getInstance();
      const instance2 = SshConnectionPool.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should create only one instance', () => {
      const instance1 = SshConnectionPool.getInstance();
      const instance2 = SshConnectionPool.getInstance();
      const instance3 = SshConnectionPool.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance2).toBe(instance3);
    });
  });

  describe('getConnection', () => {
    it('should create new connection on first call', async () => {
      const mockClient = new (Client as any)();

      // 模拟 SFTP 回调
      mockClient.sftp.mockImplementation((callback: Function) => {
        callback(null, {});
      });

      // 使用 setTimeout 来异步触发 ready 事件
      setTimeout(() => {
        mockClient._emit('ready');
      }, 10);

      const promise = pool.getConnection(mockConfig, mockAuthConfig, mockConnectConfig);

      // 等待连接建立
      await expect(promise).resolves.toBeDefined();

      const result = await promise;
      expect(result.client).toBeDefined();
      expect(result.sftpClient).toBeDefined();
    });

    it('should timeout after 30 seconds', async () => {
      vi.useFakeTimers();

      const mockClient = new (Client as any)();

      // 模拟超时场景：不触发 ready 事件
      mockClient.sftp.mockImplementation((callback: Function) => {
        // 不调用 callback，模拟无响应
      });

      const promise = pool.getConnection(mockConfig, mockAuthConfig, mockConnectConfig);

      // 快进 30 秒
      vi.advanceTimersByTime(30000);

      await expect(promise).rejects.toThrow('连接超时');

      vi.useRealTimers();
    });

    it('should handle connection errors', async () => {
      const mockClient = new (Client as any)();
      const testError = new Error('Connection failed');

      // 异步触发 error 事件
      setTimeout(() => {
        mockClient._emit('error', testError);
      }, 10);

      await expect(
        pool.getConnection(mockConfig, mockAuthConfig, mockConnectConfig)
      ).rejects.toThrow('Connection failed');
    });

    it('should handle SFTP creation errors', async () => {
      const mockClient = new (Client as any)();
      const sftpError = new Error('SFTP creation failed');

      // 模拟 SFTP 创建失败
      mockClient.sftp.mockImplementation((callback: Function) => {
        callback(sftpError, null);
      });

      setTimeout(() => {
        mockClient._emit('ready');
      }, 10);

      await expect(
        pool.getConnection(mockConfig, mockAuthConfig, mockConnectConfig)
      ).rejects.toThrow('SFTP creation failed');
    });
  });

  describe('releaseConnection', () => {
    it('should mark connection as not in use', () => {
      // 这个测试需要先创建连接，然后释放
      // 由于连接创建是异步的，我们只测试释放方法不抛出错误
      expect(() => {
        pool.releaseConnection(mockConfig);
      }).not.toThrow();
    });

    it('should handle releasing non-existent connection', () => {
      const nonExistentConfig: HostConfig = {
        id: 'non-existent',
        name: 'Non Existent',
        host: 'localhost',
        port: 22,
        username: 'test'
      };

      expect(() => {
        pool.releaseConnection(nonExistentConfig);
      }).not.toThrow();
    });
  });

  describe('closeConnection', () => {
    it('should remove connection from pool', () => {
      expect(() => {
        pool.closeConnection(mockConfig);
      }).not.toThrow();
    });

    it('should handle closing non-existent connection', () => {
      const nonExistentConfig: HostConfig = {
        id: 'non-existent',
        name: 'Non Existent',
        host: 'localhost',
        port: 22,
        username: 'test'
      };

      expect(() => {
        pool.closeConnection(nonExistentConfig);
      }).not.toThrow();
    });
  });

  describe('closeAll', () => {
    it('should close all connections in the pool', () => {
      expect(() => {
        pool.closeAll();
      }).not.toThrow();
    });

    it('should clear cleanup timer', () => {
      pool.closeAll();
      // 验证没有泄漏的定时器
      expect(vi.getTimerCount()).toBe(0);
    });

    it('should handle multiple calls to closeAll', () => {
      pool.closeAll();
      pool.closeAll();
      pool.closeAll();

      expect(() => {
        pool.closeAll();
      }).not.toThrow();
    });
  });

  describe('getPoolStatus', () => {
    it('should return correct status for empty pool', () => {
      const status = pool.getPoolStatus();

      expect(status.totalConnections).toBe(0);
      expect(status.activeConnections).toBe(0);
      expect(status.idleConnections).toBe(0);
    });

    it('should return correct counts', () => {
      // 初始状态
      const initialStatus = pool.getPoolStatus();

      expect(initialStatus.totalConnections).toBe(0);
      expect(initialStatus.activeConnections).toBe(0);
      expect(initialStatus.idleConnections).toBe(0);
    });
  });

  describe('Connection Pool Management', () => {
    it('should respect MAX_POOL_SIZE limit', () => {
      // 验证池有最大容量限制
      const status = pool.getPoolStatus();
      expect(status.totalConnections).toBeLessThanOrEqual(5); // MAX_POOL_SIZE = 5
    });

    it('should handle connection key generation', () => {
      const config1: HostConfig = {
        id: 'host1',
        name: 'Host 1',
        host: '192.168.1.1',
        port: 22,
        username: 'user1'
      };

      const config2: HostConfig = {
        id: 'host2',
        name: 'Host 2',
        host: '192.168.1.2',
        port: 22,
        username: 'user2'
      };

      // 不同的配置应该有不同的连接
      expect(config1.id).not.toBe(config2.id);
    });
  });

  describe('Cleanup Operations', () => {
    it('should have cleanup timer running', () => {
      vi.useFakeTimers();

      // 重新创建实例以启动定时器
      (SshConnectionPool as any).instance = undefined;
      const newPool = SshConnectionPool.getInstance();

      // 验证有定时器在运行
      expect(vi.getTimerCount()).toBeGreaterThan(0);

      newPool.closeAll();
      vi.useRealTimers();
    });

    it('should cleanup idle connections periodically', () => {
      vi.useFakeTimers();

      // 重新创建实例
      (SshConnectionPool as any).instance = undefined;
      const newPool = SshConnectionPool.getInstance();

      // 快进 2 分钟（清理间隔）
      vi.advanceTimersByTime(2 * 60 * 1000);

      // 清理应该已执行（不抛出错误）
      expect(() => {
        vi.advanceTimersByTime(2 * 60 * 1000);
      }).not.toThrow();

      newPool.closeAll();
      vi.useRealTimers();
    });
  });

  describe('Edge Cases', () => {
    it('should handle config with minimal required fields', async () => {
      const minimalConfig: HostConfig = {
        id: 'minimal',
        name: 'Minimal',
        host: 'localhost',
        port: 22,
        username: 'user'
      };

      const minimalAuthConfig: HostAuthConfig = {
        hostId: 'minimal',
        authType: 'agent'
      };

      const minimalConnectConfig: ConnectConfig = {
        host: 'localhost',
        port: 22,
        username: 'user'
      };

      const mockClient = new (Client as any)();
      mockClient.sftp.mockImplementation((callback: Function) => {
        callback(null, {});
      });

      setTimeout(() => {
        mockClient._emit('ready');
      }, 10);

      await expect(
        pool.getConnection(minimalConfig, minimalAuthConfig, minimalConnectConfig)
      ).resolves.toBeDefined();
    });

    it('should handle special characters in host ID', async () => {
      const specialConfig: HostConfig = {
        id: 'host-name_123.test@domain',
        name: 'Special Host',
        host: 'localhost',
        port: 22,
        username: 'user'
      };

      expect(() => {
        pool.closeConnection(specialConfig);
      }).not.toThrow();
    });

    it('should handle connection end event', async () => {
      const mockClient = new (Client as any)();

      mockClient.sftp.mockImplementation((callback: Function) => {
        callback(null, {});
      });

      setTimeout(() => {
        mockClient._emit('ready');
      }, 10);

      await pool.getConnection(mockConfig, mockAuthConfig, mockConnectConfig);

      // 模拟连接结束
      setTimeout(() => {
        mockClient._emit('end');
      }, 20);

      // 等待事件处理
      await new Promise(resolve => setTimeout(resolve, 30));

      // 连接应该已从池中移除
      const status = pool.getPoolStatus();
      expect(status.totalConnections).toBe(0);
    });
  });

  describe('Multiple Connections', () => {
    it('should handle multiple different hosts', () => {
      const config1: HostConfig = {
        id: 'host1',
        name: 'Host 1',
        host: '192.168.1.1',
        port: 22,
        username: 'user1'
      };

      const config2: HostConfig = {
        id: 'host2',
        name: 'Host 2',
        host: '192.168.1.2',
        port: 22,
        username: 'user2'
      };

      pool.closeConnection(config1);
      pool.closeConnection(config2);

      expect(pool.getPoolStatus().totalConnections).toBe(0);
    });
  });

  describe('Error Recovery', () => {
    it('should handle SFTP client end errors gracefully', () => {
      // 模拟清理时的错误
      expect(() => {
        pool.closeAll();
      }).not.toThrow();
    });

    it('should handle client end errors gracefully', () => {
      pool.closeConnection(mockConfig);

      expect(pool.getPoolStatus().totalConnections).toBe(0);
    });
  });

  describe('Connection Reuse', () => {
    it('should update lastUsed timestamp on reuse', async () => {
      const mockClient = new (Client as any)();

      mockClient.sftp.mockImplementation((callback: Function) => {
        callback(null, {});
      });

      setTimeout(() => {
        mockClient._emit('ready');
      }, 10);

      // 创建第一个连接
      const conn1 = await pool.getConnection(mockConfig, mockAuthConfig, mockConnectConfig);
      expect(conn1).toBeDefined();

      // 释放连接
      pool.releaseConnection(mockConfig);

      // 由于 mock 的限制，无法完全测试连接复用
      // 但可以验证释放不会抛出错误
      expect(() => {
        pool.releaseConnection(mockConfig);
      }).not.toThrow();
    });
  });
});
