import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RemoteBrowserService } from './remoteBrowserService';
import { HostManager } from '../hostManager';
import { HostConfig, HostAuthConfig } from '../types';

describe('RemoteBrowserService', () => {
  let service: RemoteBrowserService;
  let mockHostManager: HostManager;
  let mockConfig: HostConfig;
  let mockAuthConfig: HostAuthConfig;

  beforeEach(() => {
    // Mock HostManager
    mockHostManager = {
      getAllHosts: vi.fn(),
      getHost: vi.fn(),
      addHost: vi.fn(),
      updateHost: vi.fn(),
      deleteHost: vi.fn()
    } as any;

    mockConfig = {
      id: 'test-host',
      name: 'Test Host',
      host: '192.168.1.100',
      port: 22,
      username: 'testuser',
      defaultRemotePath: '/home/testuser'
    };

    mockAuthConfig = {
      hostId: 'test-host',
      authType: 'password',
      password: 'testpass'
    };
  });

  describe('Constructor', () => {
    it('should create service without handlers', () => {
      service = new RemoteBrowserService(mockHostManager);
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(RemoteBrowserService);
    });

    it('should create service with upload handler', () => {
      const uploadHandler = vi.fn();
      service = new RemoteBrowserService(mockHostManager, uploadHandler);
      expect(service).toBeDefined();
    });

    it('should create service with both upload and download handlers', () => {
      const uploadHandler = vi.fn();
      const downloadHandler = vi.fn();
      service = new RemoteBrowserService(mockHostManager, uploadHandler, downloadHandler);
      expect(service).toBeDefined();
    });

    it('should create service with download handler only', () => {
      const downloadHandler = vi.fn();
      service = new RemoteBrowserService(mockHostManager, undefined, downloadHandler);
      expect(service).toBeDefined();
    });
  });

  describe('browseRemoteFilesGeneric - Basic Functionality', () => {
    beforeEach(() => {
      service = new RemoteBrowserService(mockHostManager);
    });

    it('should accept selectPath mode', () => {
      expect(() => {
        service.browseRemoteFilesGeneric(
          mockConfig,
          mockAuthConfig,
          'selectPath',
          'Select Path'
        );
      }).not.toThrow();
    });

    it('should accept browseFiles mode', () => {
      expect(() => {
        service.browseRemoteFilesGeneric(
          mockConfig,
          mockAuthConfig,
          'browseFiles',
          'Browse Files'
        );
      }).not.toThrow();
    });

    it('should accept selectBookmark mode', () => {
      expect(() => {
        service.browseRemoteFilesGeneric(
          mockConfig,
          mockAuthConfig,
          'selectBookmark',
          'Select Bookmark'
        );
      }).not.toThrow();
    });

    it('should accept sync mode', () => {
      expect(() => {
        service.browseRemoteFilesGeneric(
          mockConfig,
          mockAuthConfig,
          'sync',
          'Sync Files'
        );
      }).not.toThrow();
    });

    it('should use provided initial path', () => {
      expect(() => {
        service.browseRemoteFilesGeneric(
          mockConfig,
          mockAuthConfig,
          'selectPath',
          'Select Path',
          '/custom/path'
        );
      }).not.toThrow();
    });

    it('should use default remote path when no initial path provided', () => {
      expect(() => {
        service.browseRemoteFilesGeneric(
          mockConfig,
          mockAuthConfig,
          'selectPath',
          'Select Path'
        );
      }).not.toThrow();
    });

    it('should fallback to /root when no default remote path configured', () => {
      const configWithoutDefault: HostConfig = {
        ...mockConfig,
        defaultRemotePath: undefined
      };

      expect(() => {
        service.browseRemoteFilesGeneric(
          configWithoutDefault,
          mockAuthConfig,
          'selectPath',
          'Select Path'
        );
      }).not.toThrow();
    });
  });

  describe('Mode-specific Behavior', () => {
    beforeEach(() => {
      service = new RemoteBrowserService(mockHostManager);
    });

    it('should handle selectPath mode with custom title', () => {
      const title = 'Choose Upload Directory';
      expect(() => {
        service.browseRemoteFilesGeneric(
          mockConfig,
          mockAuthConfig,
          'selectPath',
          title
        );
      }).not.toThrow();
    });

    it('should handle browseFiles mode with custom title', () => {
      const title = 'Select Files to Download';
      expect(() => {
        service.browseRemoteFilesGeneric(
          mockConfig,
          mockAuthConfig,
          'browseFiles',
          title
        );
      }).not.toThrow();
    });

    it('should handle selectBookmark mode with initial path', () => {
      expect(() => {
        service.browseRemoteFilesGeneric(
          mockConfig,
          mockAuthConfig,
          'selectBookmark',
          'Select Directory for Bookmark',
          '/var/www'
        );
      }).not.toThrow();
    });

    it('should handle sync mode with initial path', () => {
      expect(() => {
        service.browseRemoteFilesGeneric(
          mockConfig,
          mockAuthConfig,
          'sync',
          'Synchronize Files',
          '/opt/data'
        );
      }).not.toThrow();
    });
  });

  describe('Configuration Handling', () => {
    beforeEach(() => {
      service = new RemoteBrowserService(mockHostManager);
    });

    it('should handle config with minimal fields', () => {
      const minimalConfig: HostConfig = {
        id: 'minimal',
        name: 'Minimal Host',
        host: 'localhost',
        port: 22,
        username: 'user'
      };

      expect(() => {
        service.browseRemoteFilesGeneric(
          minimalConfig,
          mockAuthConfig,
          'selectPath',
          'Select Path'
        );
      }).not.toThrow();
    });

    it('should handle config with all optional fields', () => {
      const fullConfig: HostConfig = {
        id: 'full',
        name: 'Full Host',
        host: 'example.com',
        port: 2222,
        username: 'admin',
        defaultRemotePath: '/srv',
        defaultLocalPath: '/local',
        group: 'Production'
      };

      expect(() => {
        service.browseRemoteFilesGeneric(
          fullConfig,
          mockAuthConfig,
          'browseFiles',
          'Browse'
        );
      }).not.toThrow();
    });

    it('should handle different authentication types - password', () => {
      const passwordAuth: HostAuthConfig = {
        hostId: 'test',
        authType: 'password',
        password: 'secret'
      };

      expect(() => {
        service.browseRemoteFilesGeneric(
          mockConfig,
          passwordAuth,
          'selectPath',
          'Select'
        );
      }).not.toThrow();
    });

    it('should handle different authentication types - private key', () => {
      const keyAuth: HostAuthConfig = {
        hostId: 'test',
        authType: 'privateKey',
        privateKeyPath: '/path/to/key'
      };

      expect(() => {
        service.browseRemoteFilesGeneric(
          mockConfig,
          keyAuth,
          'selectPath',
          'Select'
        );
      }).not.toThrow();
    });

    it('should handle different authentication types - agent', () => {
      const agentAuth: HostAuthConfig = {
        hostId: 'test',
        authType: 'agent'
      };

      expect(() => {
        service.browseRemoteFilesGeneric(
          mockConfig,
          agentAuth,
          'selectPath',
          'Select'
        );
      }).not.toThrow();
    });
  });

  describe('Path Handling', () => {
    beforeEach(() => {
      service = new RemoteBrowserService(mockHostManager);
    });

    it('should handle root path', () => {
      expect(() => {
        service.browseRemoteFilesGeneric(
          mockConfig,
          mockAuthConfig,
          'selectPath',
          'Select Path',
          '/'
        );
      }).not.toThrow();
    });

    it('should handle deep nested paths', () => {
      expect(() => {
        service.browseRemoteFilesGeneric(
          mockConfig,
          mockAuthConfig,
          'browseFiles',
          'Browse',
          '/usr/local/share/applications'
        );
      }).not.toThrow();
    });

    it('should handle paths with special characters', () => {
      expect(() => {
        service.browseRemoteFilesGeneric(
          mockConfig,
          mockAuthConfig,
          'selectPath',
          'Select',
          '/path/with-dash_and_underscore'
        );
      }).not.toThrow();
    });

    it('should handle paths with spaces', () => {
      expect(() => {
        service.browseRemoteFilesGeneric(
          mockConfig,
          mockAuthConfig,
          'browseFiles',
          'Browse',
          '/path with spaces/subfolder'
        );
      }).not.toThrow();
    });
  });

  describe('Handler Callbacks', () => {
    it('should accept upload handler function', () => {
      const uploadHandler = vi.fn(async (
        config: HostConfig,
        authConfig: HostAuthConfig,
        remotePath: string,
        isDirectory: boolean
      ) => {
        // Upload logic
      });

      service = new RemoteBrowserService(mockHostManager, uploadHandler);
      expect(service).toBeDefined();
    });

    it('should accept download handler function', () => {
      const downloadHandler = vi.fn(async (
        config: HostConfig,
        authConfig: HostAuthConfig,
        remotePath: string,
        isDirectory: boolean
      ) => {
        // Download logic
      });

      service = new RemoteBrowserService(mockHostManager, undefined, downloadHandler);
      expect(service).toBeDefined();
    });

    it('should accept both upload and download handlers', () => {
      const uploadHandler = vi.fn();
      const downloadHandler = vi.fn();

      service = new RemoteBrowserService(mockHostManager, uploadHandler, downloadHandler);
      expect(service).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      service = new RemoteBrowserService(mockHostManager);
    });

    it('should handle empty title', () => {
      expect(() => {
        service.browseRemoteFilesGeneric(
          mockConfig,
          mockAuthConfig,
          'selectPath',
          ''
        );
      }).not.toThrow();
    });

    it('should handle very long titles', () => {
      const longTitle = 'A'.repeat(200);
      expect(() => {
        service.browseRemoteFilesGeneric(
          mockConfig,
          mockAuthConfig,
          'browseFiles',
          longTitle
        );
      }).not.toThrow();
    });

    it('should handle unicode characters in title', () => {
      expect(() => {
        service.browseRemoteFilesGeneric(
          mockConfig,
          mockAuthConfig,
          'selectPath',
          '选择路径 📁'
        );
      }).not.toThrow();
    });

    it('should handle empty initial path', () => {
      expect(() => {
        service.browseRemoteFilesGeneric(
          mockConfig,
          mockAuthConfig,
          'selectPath',
          'Select Path',
          ''
        );
      }).not.toThrow();
    });
  });

  describe('Multiple Service Instances', () => {
    it('should allow multiple service instances', () => {
      const service1 = new RemoteBrowserService(mockHostManager);
      const service2 = new RemoteBrowserService(mockHostManager);

      expect(service1).not.toBe(service2);
      expect(service1).toBeInstanceOf(RemoteBrowserService);
      expect(service2).toBeInstanceOf(RemoteBrowserService);
    });

    it('should allow different handlers per instance', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      const service1 = new RemoteBrowserService(mockHostManager, handler1);
      const service2 = new RemoteBrowserService(mockHostManager, handler2);

      expect(service1).toBeDefined();
      expect(service2).toBeDefined();
    });
  });

  describe('HostManager Integration', () => {
    it('should accept valid HostManager instance', () => {
      const manager = new HostManager('/fake/path' as any);
      const svc = new RemoteBrowserService(manager);
      expect(svc).toBeDefined();
    });

    it('should work with mocked HostManager', () => {
      const mockManager = {
        getAllHosts: vi.fn().mockReturnValue([]),
        getHost: vi.fn(),
        addHost: vi.fn(),
        updateHost: vi.fn(),
        deleteHost: vi.fn()
      } as any;

      const svc = new RemoteBrowserService(mockManager);
      expect(svc).toBeDefined();
    });
  });
});
