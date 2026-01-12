import { Client, ConnectConfig } from 'ssh2';
// @ts-ignore
import SftpClient from 'ssh2-sftp-client';
import { HostConfig, HostAuthConfig } from './types';
import { logger } from './logger';

/**
 * SSH 连接池条目
 */
interface PooledConnection {
  /** SSH2 Client 实例 */
  client: Client;
  /** SFTP Client 实例 */
  sftpClient: SftpClient | null;
  /** 主机标识符 (hostId) */
  hostId: string;
  /** 连接配置 */
  config: ConnectConfig;
  /** 最后使用时间 */
  lastUsed: number;
  /** 是否正在使用 */
  inUse: boolean;
  /** 连接状态 */
  isReady: boolean;
}

/**
 * SSH 连接池管理器
 * 复用 SSH 连接以提升性能
 */
export class SshConnectionPool {
  private static instance: SshConnectionPool;
  private pool: Map<string, PooledConnection> = new Map();

  /** 连接池最大容量 */
  private readonly MAX_POOL_SIZE = 5;

  /** 连接空闲超时时间（毫秒）默认 5 分钟 */
  private readonly IDLE_TIMEOUT = 5 * 60 * 1000;

  /** 清理定时器 */
  private cleanupTimer?: NodeJS.Timeout;

  private constructor() {
    // 启动定期清理任务（每 2 分钟检查一次）
    this.cleanupTimer = setInterval(() => {
      this.cleanupIdleConnections();
    }, 2 * 60 * 1000);
  }

  /**
   * 获取连接池单例
   */
  static getInstance(): SshConnectionPool {
    if (!SshConnectionPool.instance) {
      SshConnectionPool.instance = new SshConnectionPool();
    }
    return SshConnectionPool.instance;
  }

  /**
   * 生成连接键
   */
  private getConnectionKey(hostId: string): string {
    return hostId;
  }

  /**
   * 获取或创建连接
   */
  async getConnection(
    config: HostConfig,
    authConfig: HostAuthConfig,
    connectConfig: ConnectConfig
  ): Promise<{ client: Client; sftpClient: SftpClient }> {
    const key = this.getConnectionKey(config.id);

    // 检查是否有可用连接
    const pooled = this.pool.get(key);

    if (pooled && pooled.isReady && !pooled.inUse) {
      // 复用现有连接
      logger.info(`Reusing SSH connection for ${config.name}`);
      pooled.inUse = true;
      pooled.lastUsed = Date.now();

      // 如果没有 SFTP 客户端,创建一个
      if (!pooled.sftpClient) {
        pooled.sftpClient = await this.createSftpClient(pooled.client);
      }

      return {
        client: pooled.client,
        sftpClient: pooled.sftpClient
      };
    }

    // 创建新连接
    logger.info(`Creating new SSH connection for ${config.name}`);
    const { client, sftpClient } = await this.createNewConnection(
      config,
      authConfig,
      connectConfig
    );

    // 添加到连接池
    this.addToPool(key, client, sftpClient, config);

    return { client, sftpClient };
  }

  /**
   * 创建新连接
   */
  private async createNewConnection(
    config: HostConfig,
    authConfig: HostAuthConfig,
    connectConfig: ConnectConfig
  ): Promise<{ client: Client; sftpClient: SftpClient }> {
    return new Promise((resolve, reject) => {
      const client = new Client();
      let resolved = false;

      client
        .on('ready', async () => {
          try {
            const sftpClient = await this.createSftpClient(client);
            resolved = true;
            resolve({ client, sftpClient });
          } catch (error) {
            client.end();
            reject(error);
          }
        })
        .on('error', (err) => {
          if (!resolved) {
            reject(err);
          }
        })
        .on('end', () => {
          // 连接关闭时从池中移除
          const key = this.getConnectionKey(config.id);
          this.removeFromPool(key);
        })
        .connect(connectConfig);

      // 30 秒超时
      setTimeout(() => {
        if (!resolved) {
          client.end();
          reject(new Error('连接超时'));
        }
      }, 30000);
    });
  }

  /**
   * 创建 SFTP 客户端
   */
  private async createSftpClient(client: Client): Promise<SftpClient> {
    return new Promise((resolve, reject) => {
      client.sftp((err, sftp) => {
        if (err) {
          reject(err);
          return;
        }

        // 创建 ssh2-sftp-client 包装器
        const sftpClient = new SftpClient();

        // 使用已有的 SFTP 会话
        (sftpClient as any).sftp = sftp;
        (sftpClient as any).client = client;

        resolve(sftpClient);
      });
    });
  }

  /**
   * 添加连接到池中
   */
  private addToPool(
    key: string,
    client: Client,
    sftpClient: SftpClient,
    config: HostConfig
  ): void {
    // 如果池已满，移除最旧的未使用连接
    if (this.pool.size >= this.MAX_POOL_SIZE) {
      this.removeOldestUnusedConnection();
    }

    this.pool.set(key, {
      client,
      sftpClient,
      hostId: config.id,
      config: {} as ConnectConfig, // 不存储敏感配置
      lastUsed: Date.now(),
      inUse: true,
      isReady: true
    });

    logger.info(`Added connection to pool. Pool size: ${this.pool.size}`);
  }

  /**
   * 从池中移除连接
   */
  private removeFromPool(key: string): void {
    const pooled = this.pool.get(key);
    if (pooled) {
      try {
        if (pooled.sftpClient) {
          (pooled.sftpClient as any).end?.();
        }
        pooled.client.end();
      } catch (error) {
        logger.error('Error closing pooled connection', error as Error);
      }
      this.pool.delete(key);
      logger.info(`Removed connection from pool. Pool size: ${this.pool.size}`);
    }
  }

  /**
   * 移除最旧的未使用连接
   */
  private removeOldestUnusedConnection(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, pooled] of this.pool.entries()) {
      if (!pooled.inUse && pooled.lastUsed < oldestTime) {
        oldestKey = key;
        oldestTime = pooled.lastUsed;
      }
    }

    if (oldestKey) {
      logger.info(`Removing oldest unused connection: ${oldestKey}`);
      this.removeFromPool(oldestKey);
    }
  }

  /**
   * 释放连接（标记为可复用）
   */
  releaseConnection(config: HostConfig): void {
    const key = this.getConnectionKey(config.id);
    const pooled = this.pool.get(key);

    if (pooled) {
      pooled.inUse = false;
      pooled.lastUsed = Date.now();
      logger.info(`Released connection for ${config.name}`);
    }
  }

  /**
   * 强制关闭连接
   */
  closeConnection(config: HostConfig): void {
    const key = this.getConnectionKey(config.id);
    this.removeFromPool(key);
  }

  /**
   * 清理空闲超时的连接
   */
  private cleanupIdleConnections(): void {
    const now = Date.now();
    const toRemove: string[] = [];

    for (const [key, pooled] of this.pool.entries()) {
      const idleTime = now - pooled.lastUsed;

      if (!pooled.inUse && idleTime > this.IDLE_TIMEOUT) {
        toRemove.push(key);
      }
    }

    toRemove.forEach(key => {
      logger.info(`Cleaning up idle connection: ${key}`);
      this.removeFromPool(key);
    });

    if (toRemove.length > 0) {
      logger.info(`Cleaned up ${toRemove.length} idle connection(s)`);
    }
  }

  /**
   * 关闭所有连接
   */
  closeAll(): void {
    logger.info('Closing all pooled connections');

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    for (const key of Array.from(this.pool.keys())) {
      this.removeFromPool(key);
    }
  }

  /**
   * 获取连接池状态
   */
  getPoolStatus(): {
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
  } {
    let active = 0;
    let idle = 0;

    for (const pooled of this.pool.values()) {
      if (pooled.inUse) {
        active++;
      } else {
        idle++;
      }
    }

    return {
      totalConnections: this.pool.size,
      activeConnections: active,
      idleConnections: idle
    };
  }
}
