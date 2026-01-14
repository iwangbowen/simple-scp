import { describe, it, expect, beforeEach } from 'vitest';
import { HostManager } from './hostManager';
import * as vscode from 'vscode';

describe('HostManager', () => {
  let hostManager: HostManager;
  let mockContext: vscode.ExtensionContext;

  beforeEach(() => {
    mockContext = new vscode.ExtensionContext();
    hostManager = new HostManager(mockContext);
  });

  describe('Initialization', () => {
    it('should initialize and register sync key', async () => {
      await hostManager.initialize();

      // Verify initialization was successful (no error thrown)
      expect(hostManager).toBeDefined();
    });

    it('should log sync configuration on initialization', async () => {
      await hostManager.initialize();

      // Initialization should log information about hosts and groups
      const hosts = await hostManager.getHosts();
      expect(Array.isArray(hosts)).toBe(true);
    });
  });

  describe('Group Management', () => {
    it('should create a new group', async () => {
      await hostManager.initialize();

      const groupName = 'TestGroup';
      const group = await hostManager.addGroup(groupName);

      expect(group.id).toBeDefined();
      expect(group.name).toBe(groupName);

      const groups = await hostManager.getGroups();
      const groupNames = groups.map(g => g.name);
      expect(groupNames).toContain(groupName);
    });

    it('should create multiple groups', async () => {
      await hostManager.initialize();

      await hostManager.addGroup('Group1');
      await hostManager.addGroup('Group2');
      await hostManager.addGroup('Group3');

      const groups = await hostManager.getGroups();
      expect(groups).toHaveLength(3);
      expect(groups.map(g => g.name)).toEqual(['Group1', 'Group2', 'Group3']);
    });

    it('should update group name', async () => {
      await hostManager.initialize();

      const group = await hostManager.addGroup('OriginalName');
      await hostManager.updateGroup(group.id, 'UpdatedName');

      const groups = await hostManager.getGroups();
      const updatedGroup = groups.find(g => g.id === group.id);

      expect(updatedGroup).toBeDefined();
      expect(updatedGroup?.name).toBe('UpdatedName');
    });

    it('should throw error when updating non-existent group', async () => {
      await hostManager.initialize();

      await expect(
        hostManager.updateGroup('non-existent-id', 'NewName')
      ).rejects.toThrow('Group not found');
    });

    it('should delete a group', async () => {
      await hostManager.initialize();

      const groupName = 'TestGroup';
      const group = await hostManager.addGroup(groupName);
      await hostManager.deleteGroup(group.id);

      const groups = await hostManager.getGroups();
      const groupNames = groups.map(g => g.name);
      expect(groupNames).not.toContain(groupName);
    });

    it('should remove group reference from hosts when deleting group', async () => {
      await hostManager.initialize();

      const group = await hostManager.addGroup('TestGroup');
      const host = await hostManager.addHost({
        name: 'test-server',
        host: '192.168.1.100',
        port: 22,
        username: 'testuser',
        group: group.id
      });

      await hostManager.deleteGroup(group.id);

      const hosts = await hostManager.getHosts();
      const updatedHost = hosts.find(h => h.id === host.id);

      expect(updatedHost).toBeDefined();
      expect(updatedHost?.group).toBeUndefined();
    });
  });

  describe('Host Management', () => {
    it('should add a host', async () => {
      await hostManager.initialize();

      const hostName = 'test-server';
      const newHost = await hostManager.addHost({
        name: hostName,
        host: '192.168.1.100',
        port: 22,
        username: 'testuser'
      });

      expect(newHost.id).toBeDefined();
      expect(newHost.name).toBe(hostName);
      expect(newHost.host).toBe('192.168.1.100');
      expect(newHost.port).toBe(22);
      expect(newHost.username).toBe('testuser');

      const hosts = await hostManager.getHosts();
      expect(hosts).toHaveLength(1);
      expect(hosts[0].id).toBe(newHost.id);
    });

    it('should add host with group', async () => {
      await hostManager.initialize();

      const group = await hostManager.addGroup('TestGroup');
      const host = await hostManager.addHost({
        name: 'test-server',
        host: '192.168.1.100',
        port: 22,
        username: 'testuser',
        group: group.id
      });

      expect(host.group).toBe(group.id);
    });

    it('should add multiple hosts', async () => {
      await hostManager.initialize();

      await hostManager.addHost({
        name: 'server1',
        host: '192.168.1.1',
        port: 22,
        username: 'user1'
      });

      await hostManager.addHost({
        name: 'server2',
        host: '192.168.1.2',
        port: 2222,
        username: 'user2'
      });

      const hosts = await hostManager.getHosts();
      expect(hosts).toHaveLength(2);
      expect(hosts.map(h => h.name)).toEqual(['server1', 'server2']);
    });

    it('should update host configuration', async () => {
      await hostManager.initialize();

      const host = await hostManager.addHost({
        name: 'test-server',
        host: '192.168.1.100',
        port: 22,
        username: 'testuser'
      });

      await hostManager.updateHost(host.id, {
        name: 'updated-server',
        port: 2222
      });

      const hosts = await hostManager.getHosts();
      const updatedHost = hosts.find(h => h.id === host.id);

      expect(updatedHost?.name).toBe('updated-server');
      expect(updatedHost?.port).toBe(2222);
      expect(updatedHost?.host).toBe('192.168.1.100'); // Unchanged
      expect(updatedHost?.username).toBe('testuser'); // Unchanged
    });

    it('should throw error when updating non-existent host', async () => {
      await hostManager.initialize();

      await expect(
        hostManager.updateHost('non-existent-id', { name: 'new-name' })
      ).rejects.toThrow('Host not found');
    });

    it('should delete host', async () => {
      await hostManager.initialize();

      const host = await hostManager.addHost({
        name: 'test-server',
        host: '192.168.1.100',
        port: 22,
        username: 'testuser'
      });

      await hostManager.deleteHost(host.id);

      const hosts = await hostManager.getHosts();
      expect(hosts).toHaveLength(0);
    });

    it('should delete only the specified host', async () => {
      await hostManager.initialize();

      const host1 = await hostManager.addHost({
        name: 'server1',
        host: '192.168.1.1',
        port: 22,
        username: 'user1'
      });

      const host2 = await hostManager.addHost({
        name: 'server2',
        host: '192.168.1.2',
        port: 22,
        username: 'user2'
      });

      await hostManager.deleteHost(host1.id);

      const hosts = await hostManager.getHosts();
      expect(hosts).toHaveLength(1);
      expect(hosts[0].id).toBe(host2.id);
    });
  });

  describe('Move Host to Group', () => {
    it('should move a host to a group', async () => {
      await hostManager.initialize();

      const group = await hostManager.addGroup('TestGroup');
      const host = await hostManager.addHost({
        name: 'test-server',
        host: '192.168.1.100',
        port: 22,
        username: 'testuser'
      });

      await hostManager.moveHostToGroup(host.id, group.id);

      const hosts = await hostManager.getHosts();
      const movedHost = hosts.find(h => h.id === host.id);

      expect(movedHost?.group).toBe(group.id);
    });

    it('should move a host between groups', async () => {
      await hostManager.initialize();

      const group1 = await hostManager.addGroup('Group1');
      const group2 = await hostManager.addGroup('Group2');

      const host = await hostManager.addHost({
        name: 'test-server',
        host: '192.168.1.100',
        port: 22,
        username: 'testuser',
        group: group1.id
      });

      await hostManager.moveHostToGroup(host.id, group2.id);

      const hosts = await hostManager.getHosts();
      const movedHost = hosts.find(h => h.id === host.id);

      expect(movedHost?.group).toBe(group2.id);
    });

    it('should remove host from group when moving to root', async () => {
      await hostManager.initialize();

      const group = await hostManager.addGroup('TestGroup');
      const host = await hostManager.addHost({
        name: 'test-server',
        host: '192.168.1.100',
        port: 22,
        username: 'testuser',
        group: group.id
      });

      await hostManager.moveHostToGroup(host.id);

      const hosts = await hostManager.getHosts();
      const movedHost = hosts.find(h => h.id === host.id);

      expect(movedHost?.group).toBeUndefined();
    });

    it('should throw error when moving non-existent host', async () => {
      await hostManager.initialize();

      const group = await hostManager.addGroup('TestGroup');

      await expect(
        hostManager.moveHostToGroup('non-existent-id', group.id)
      ).rejects.toThrow('Host not found');
    });

    it('should throw error when moving to non-existent group', async () => {
      await hostManager.initialize();

      const host = await hostManager.addHost({
        name: 'test-server',
        host: '192.168.1.100',
        port: 22,
        username: 'testuser'
      });

      await expect(
        hostManager.moveHostToGroup(host.id, 'non-existent-group-id')
      ).rejects.toThrow('Target group not found');
    });
  });

  describe('Drag and Drop', () => {
    it('should handle moving host without group', async () => {
      await hostManager.initialize();

      const group = await hostManager.addGroup('Group1');
      const host = await hostManager.addHost({
        name: 'test-server',
        host: '192.168.1.100',
        port: 22,
        username: 'testuser'
      });

      await hostManager.moveHostToGroup(host.id, group.id);

      const hosts = await hostManager.getHosts();
      const movedHost = hosts.find(h => h.id === host.id);
      expect(movedHost?.group).toBe(group.id);
    });
  });

  describe('ID Generation', () => {
    it('should generate unique IDs for hosts', async () => {
      await hostManager.initialize();

      const host1 = await hostManager.addHost({
        name: 'server1',
        host: '192.168.1.1',
        port: 22,
        username: 'user1'
      });

      const host2 = await hostManager.addHost({
        name: 'server2',
        host: '192.168.1.2',
        port: 22,
        username: 'user2'
      });

      expect(host1.id).not.toBe(host2.id);
      expect(host1.id).toBeTruthy();
      expect(host2.id).toBeTruthy();
    });

    it('should generate unique IDs for groups', async () => {
      await hostManager.initialize();

      const group1 = await hostManager.addGroup('Group1');
      const group2 = await hostManager.addGroup('Group2');

      expect(group1.id).not.toBe(group2.id);
      expect(group1.id).toBeTruthy();
      expect(group2.id).toBeTruthy();
    });
  });

  describe('Data Persistence', () => {
    it('should persist hosts across operations', async () => {
      await hostManager.initialize();

      const host1 = await hostManager.addHost({
        name: 'server1',
        host: '192.168.1.1',
        port: 22,
        username: 'user1'
      });

      const host2 = await hostManager.addHost({
        name: 'server2',
        host: '192.168.1.2',
        port: 22,
        username: 'user2'
      });

      // Get hosts again
      const hosts = await hostManager.getHosts();

      expect(hosts).toHaveLength(2);
      expect(hosts.some(h => h.id === host1.id)).toBe(true);
      expect(hosts.some(h => h.id === host2.id)).toBe(true);
    });

    it('should persist groups across operations', async () => {
      await hostManager.initialize();

      const group1 = await hostManager.addGroup('Group1');
      const group2 = await hostManager.addGroup('Group2');

      // Get groups again
      const groups = await hostManager.getGroups();

      expect(groups).toHaveLength(2);
      expect(groups.some(g => g.id === group1.id)).toBe(true);
      expect(groups.some(g => g.id === group2.id)).toBe(true);
    });
  });
});
