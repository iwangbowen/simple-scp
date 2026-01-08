import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { HostManager } from './hostManager';
import { HostTreeProvider, HostTreeItem } from './hostTreeProvider';
import { SshConnectionManager } from './sshConnectionManager';
import { HostConfig, GroupConfig } from './types';

export class CommandHandler {
    private readonly hostManager: HostManager;
    private readonly treeProvider: HostTreeProvider;

    constructor(hostManager: HostManager, treeProvider: HostTreeProvider) {
        this.hostManager = hostManager;
        this.treeProvider = treeProvider;
    }

    public registerCommands(context: vscode.ExtensionContext): void {
        context.subscriptions.push(
            vscode.commands.registerCommand('simple-scp.addHost', () => this.addHost()),
            vscode.commands.registerCommand('simple-scp.editHost', (item: HostTreeItem) => this.editHost(item)),
            vscode.commands.registerCommand('simple-scp.deleteHost', (item: HostTreeItem) => this.deleteHost(item)),
            vscode.commands.registerCommand('simple-scp.addGroup', () => this.addGroup()),
            vscode.commands.registerCommand('simple-scp.importFromSshConfig', () => this.importFromSshConfig()),
            vscode.commands.registerCommand('simple-scp.uploadFile', (uri: vscode.Uri) => this.uploadFile(uri)),
            vscode.commands.registerCommand('simple-scp.setupPasswordlessLogin', (item: HostTreeItem) => this.setupPasswordlessLogin(item)),
            vscode.commands.registerCommand('simple-scp.testConnection', (item: HostTreeItem) => this.testConnection(item)),
            vscode.commands.registerCommand('simple-scp.refresh', () => this.refresh())
        );
    }

    private async addHost(): Promise<void> {
        // Prompt for host name
        const name = await vscode.window.showInputBox({
            prompt: 'Enter host name',
            placeHolder: 'e.g., Production Server',
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Host name cannot be empty';
                }
                return null;
            }
        });

        if (!name) {
            return;
        }

        // Prompt for host address
        const host = await vscode.window.showInputBox({
            prompt: 'Enter host address',
            placeHolder: 'e.g., 192.168.1.100 or example.com',
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Host address cannot be empty';
                }
                return null;
            }
        });

        if (!host) {
            return;
        }

        // Prompt for port
        const portStr = await vscode.window.showInputBox({
            prompt: 'Enter SSH port',
            placeHolder: '22',
            value: '22',
            validateInput: (value) => {
                const port = Number.parseInt(value);
                if (Number.isNaN(port) || port < 1 || port > 65535) {
                    return 'Port must be a number between 1 and 65535';
                }
                return null;
            }
        });

        if (!portStr) {
            return;
        }

        const port = Number.parseInt(portStr);

        // Prompt for username
        const username = await vscode.window.showInputBox({
            prompt: 'Enter username',
            placeHolder: 'e.g., root',
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Username cannot be empty';
                }
                return null;
            }
        });

        if (!username) {
            return;
        }

        // Prompt for authentication type
        const authType = await vscode.window.showQuickPick(
            [
                { label: 'Password', value: 'password' as const },
                { label: 'Private Key', value: 'privateKey' as const },
                { label: 'SSH Agent', value: 'agent' as const }
            ],
            {
                placeHolder: 'Select authentication type'
            }
        );

        if (!authType) {
            return;
        }

        let password: string | undefined;
        let privateKeyPath: string | undefined;

        if (authType.value === 'password') {
            // Prompt for password
            password = await vscode.window.showInputBox({
                prompt: 'Enter password',
                password: true,
                placeHolder: 'Password'
            });

            if (password === undefined) {
                return;
            }
        } else if (authType.value === 'privateKey') {
            // Prompt for private key path
            const defaultKeyPath = path.join(os.homedir(), '.ssh', 'id_rsa');
            const keyPath = await vscode.window.showInputBox({
                prompt: 'Enter private key path',
                value: defaultKeyPath,
                placeHolder: defaultKeyPath,
                validateInput: (value) => {
                    if (!value || value.trim().length === 0) {
                        return 'Private key path cannot be empty';
                    }
                    const expandedPath = value.replace('~', os.homedir());
                    if (!fs.existsSync(expandedPath)) {
                        return 'Private key file does not exist';
                    }
                    return null;
                }
            });

            if (!keyPath) {
                return;
            }

            privateKeyPath = keyPath;

            // Optional: prompt for passphrase
            const passphrase = await vscode.window.showInputBox({
                prompt: 'Enter passphrase (leave empty if no passphrase)',
                password: true,
                placeHolder: 'Passphrase (optional)'
            });

            if (passphrase) {
                password = passphrase;
            }
        }

        // Prompt for group (optional)
        const groups = await this.hostManager.getGroups();
        const groupItems: Array<{ label: string; value?: string }> = groups.map(g => ({ label: g.name, value: g.id }));
        groupItems.unshift({ label: '$(add) Create new group', value: '__NEW__' }, { label: '$(folder) No group', value: undefined });

        const selectedGroup = await vscode.window.showQuickPick(groupItems, {
            placeHolder: 'Select a group (optional)'
        });

        let group: string | undefined;

        if (selectedGroup) {
            if (selectedGroup.value === '__NEW__') {
                const newGroup = await vscode.window.showInputBox({
                    prompt: 'Enter new group name',
                    placeHolder: 'e.g., Production Servers'
                });
                if (newGroup && newGroup.trim().length > 0) {
                    const createdGroup = await this.hostManager.addGroup(newGroup.trim());
                    group = createdGroup.id;
                }
            } else {
                group = selectedGroup.value;
            }
        }

        // Create host config
        const hostConfig: Omit<HostConfig, 'id'> = {
            name,
            host,
            port,
            username,
            authType: authType.value,
            password,
            privateKeyPath,
            group
        };

        // Add host
        await this.hostManager.addHost(hostConfig);
        this.treeProvider.refresh();

        vscode.window.showInformationMessage(`Host "${name}" added successfully`);
    }

    private async editHost(item: HostTreeItem): Promise<void> {
        if (item.type !== 'host') {
            vscode.window.showErrorMessage('Please select a host to edit');
            return;
        }

        const hostConfig = item.data as HostConfig;

        // Edit host name
        const newName = await vscode.window.showInputBox({
            prompt: 'Enter new host name',
            value: hostConfig.name,
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Host name cannot be empty';
                }
                return null;
            }
        });

        if (!newName) {
            return;
        }

        // Edit default remote path
        const remotePath = await vscode.window.showInputBox({
            prompt: 'Enter default remote path (optional)',
            value: hostConfig.defaultRemotePath || `/home/${hostConfig.username}`,
            placeHolder: '/home/user'
        });

        // Update host
        const updates: Partial<HostConfig> = {
            name: newName
        };

        if (remotePath && remotePath.trim().length > 0) {
            updates.defaultRemotePath = remotePath.trim();
        }

        await this.hostManager.updateHost(hostConfig.id, updates);
        this.treeProvider.refresh();

        vscode.window.showInformationMessage(`Host "${newName}" updated successfully`);
    }

    private async deleteHost(item: HostTreeItem): Promise<void> {
        if (!item) {
            vscode.window.showErrorMessage('Please select a host or group to delete');
            return;
        }

        let message: string;
        let confirmText: string;

        if (item.type === 'group') {
            const groupName = item.label;
            const groupData = item.data as GroupConfig;
            const hosts = await this.hostManager.getHosts();
            const hostsInGroup = hosts.filter(h => h.group === groupData.id);
            message = `Are you sure you want to delete group "${groupName}" and all ${hostsInGroup.length} host(s) in it?`;
            confirmText = 'Delete Group';
        } else {
            const hostData = item.data as HostConfig;
            message = `Are you sure you want to delete host "${hostData.name}"?`;
            confirmText = 'Delete Host';
        }

        const result = await vscode.window.showWarningMessage(
            message,
            { modal: true },
            confirmText,
            'Cancel'
        );

        if (result !== confirmText) {
            return;
        }

        if (item.type === 'group') {
            const groupData = item.data as GroupConfig;
            await this.hostManager.deleteGroup(groupData.id);
            vscode.window.showInformationMessage(`Group "${item.label}" deleted successfully`);
        } else {
            const hostData = item.data as HostConfig;
            await this.hostManager.deleteHost(hostData.id);
            vscode.window.showInformationMessage(`Host "${hostData.name}" deleted successfully`);
        }

        this.treeProvider.refresh();
    }

    private async addGroup(): Promise<void> {
        const groupName = await vscode.window.showInputBox({
            prompt: 'Enter group name',
            placeHolder: 'e.g., Production Servers',
            validateInput: async (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Group name cannot be empty';
                }
                const existingGroups = await this.hostManager.getGroups();
                if (existingGroups.some(g => g.name === value.trim())) {
                    return 'Group already exists';
                }
                return null;
            }
        });

        if (!groupName) {
            return;
        }

        await this.hostManager.addGroup(groupName.trim());
        this.treeProvider.refresh();
        vscode.window.showInformationMessage(`Group "${groupName}" created successfully`);
    }

    private async importFromSshConfig(): Promise<void> {
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Importing SSH config',
                cancellable: false
            },
            async (progress) => {
                progress.report({ message: 'Reading SSH config file...' });

                try {
                    const importedHosts = await this.hostManager.importFromSshConfig();

                    progress.report({ message: `Found ${importedHosts.length} host(s)` });

                    this.treeProvider.refresh();

                    vscode.window.showInformationMessage(
                        `Successfully imported ${importedHosts.length} host(s) from SSH config`
                    );
                } catch (error) {
                    vscode.window.showErrorMessage(
                        `Failed to import SSH config: ${error instanceof Error ? error.message : String(error)}`
                    );
                }
            }
        );
    }

    private async uploadFile(uri?: vscode.Uri): Promise<void> {
        let filePath: string;

        if (uri) {
            filePath = uri.fsPath;
        } else {
            const activeEditor = vscode.window.activeTextEditor;
            if (!activeEditor?.document || activeEditor.document.uri.scheme !== 'file') {
                vscode.window.showErrorMessage('No file selected or active');
                return;
            }
            filePath = activeEditor.document.uri.fsPath;
        }

        if (!fs.existsSync(filePath)) {
            vscode.window.showErrorMessage('File does not exist');
            return;
        }

        // Select host
        const hosts = await this.hostManager.getHosts();
        if (hosts.length === 0) {
            vscode.window.showErrorMessage('No hosts configured. Please add a host first.');
            return;
        }

        const hostItems = hosts.map(h => ({
            label: h.name,
            description: `${h.username}@${h.host}:${h.port}`,
            host: h
        }));

        const selectedHost = await vscode.window.showQuickPick(hostItems, {
            placeHolder: 'Select target host'
        });

        if (!selectedHost) {
            return;
        }

        // Select remote path
        const remotePath = await this.selectRemotePath(selectedHost.host);
        if (!remotePath) {
            return;
        }

        // Upload file
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Uploading to ${selectedHost.host.name}`,
                cancellable: false
            },
            async (progress) => {
                progress.report({ message: 'Connecting...' });

                try {
                    progress.report({ message: 'Uploading file...' });

                    const fileName = path.basename(filePath);
                    const remoteFilePath = remotePath.endsWith('/')
                        ? remotePath + fileName
                        : `${remotePath}/${fileName}`;

                    await SshConnectionManager.uploadFile(
                        selectedHost.host,
                        filePath,
                        remoteFilePath,
                        (transferred: number, total: number) => {
                            const percent = Math.round((transferred / total) * 100);
                            progress.report({ message: `Uploading... ${percent}%` });
                        }
                    );

                    vscode.window.showInformationMessage(
                        `File uploaded successfully to ${remoteFilePath}`
                    );
                } catch (error) {
                    vscode.window.showErrorMessage(
                        `Upload failed: ${error instanceof Error ? error.message : String(error)}`
                    );
                }
            }
        );
    }

    private async selectRemotePath(hostConfig: HostConfig): Promise<string | undefined> {
        const defaultPath = hostConfig.defaultRemotePath || `/home/${hostConfig.username}`;

        const action = await vscode.window.showQuickPick(
            [
                { label: '$(edit) Enter path manually', value: 'manual' },
                { label: '$(folder) Browse directories', value: 'browse' }
            ],
            {
                placeHolder: 'How do you want to select the remote path?'
            }
        );

        if (!action) {
            return undefined;
        }

        if (action.value === 'manual') {
            return await vscode.window.showInputBox({
                prompt: 'Enter remote directory path',
                value: defaultPath,
                placeHolder: '/path/to/directory'
            });
        } else {
            // Browse directories
            return await this.browseRemoteDirectory(hostConfig, defaultPath);
        }
    }

    private async browseRemoteDirectory(hostConfig: HostConfig, startPath: string): Promise<string | undefined> {
        try {
            let currentPath = startPath;

            while (true) {
                const directories = await SshConnectionManager.listRemoteDirectory(hostConfig, currentPath);

                const quickPickItems: Array<{ label: string; value: string; description?: string }> = [
                    { label: '$(check) Select this directory', value: '__SELECT__', description: currentPath },
                    { label: '$(arrow-up) Parent directory', value: '__PARENT__', description: '..' }
                ];

                directories.forEach(dir => {
                    quickPickItems.push({
                        label: `$(folder) ${dir}`,
                        value: dir,
                        description: ''
                    });
                });

                const selected = await vscode.window.showQuickPick(quickPickItems, {
                    placeHolder: `Current: ${currentPath}`
                });

                if (!selected) {
                    return undefined;
                }

                if (selected.value === '__SELECT__') {
                    return currentPath;
                } else if (selected.value === '__PARENT__') {
                    currentPath = path.posix.dirname(currentPath);
                } else {
                    currentPath = path.posix.join(currentPath, selected.value);
                }
            }
        } catch (error) {
            vscode.window.showErrorMessage(
                `Failed to browse directories: ${error instanceof Error ? error.message : String(error)}`
            );
            return undefined;
        }
    }

    private async setupPasswordlessLogin(item: HostTreeItem): Promise<void> {
        if (item.type !== 'host') {
            vscode.window.showErrorMessage('Please select a host');
            return;
        }

        const hostConfig = item.data as HostConfig;

        // Check if already using key authentication
        if (hostConfig.authType === 'privateKey' && !hostConfig.password) {
            vscode.window.showInformationMessage(
                `Host "${hostConfig.name}" is already configured for key-based authentication`
            );
            return;
        }

        // Find public key
        const sshDir = path.join(os.homedir(), '.ssh');
        const possibleKeys = ['id_rsa.pub', 'id_ecdsa.pub', 'id_ed25519.pub'];
        let publicKeyPath: string | undefined;

        for (const keyName of possibleKeys) {
            const keyPath = path.join(sshDir, keyName);
            if (fs.existsSync(keyPath)) {
                publicKeyPath = keyPath;
                break;
            }
        }

        if (!publicKeyPath) {
            const result = await vscode.window.showWarningMessage(
                'No SSH public key found. Do you want to generate one?',
                'Generate Key',
                'Cancel'
            );

            if (result === 'Generate Key') {
                vscode.window.showInformationMessage(
                    'Please run "ssh-keygen" in your terminal to generate SSH keys'
                );
            }
            return;
        }

        // Upload public key to remote host
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Setting up passwordless login for ${hostConfig.name}`,
                cancellable: false
            },
            async (progress) => {
                progress.report({ message: 'Connecting...' });

                try {
                    await SshConnectionManager.setupPasswordlessLogin(hostConfig, publicKeyPath);
                    progress.report({ message: 'Public key uploaded successfully' });

                    // Update host config to use key authentication
                    const privateKeyPath = publicKeyPath.replace('.pub', '');
                    await this.hostManager.updateHost(hostConfig.id, {
                        authType: 'privateKey',
                        privateKeyPath,
                        password: undefined
                    });

                    this.treeProvider.refresh();

                    vscode.window.showInformationMessage(
                        `Passwordless login configured successfully for "${hostConfig.name}"`
                    );
                } catch (error) {
                    vscode.window.showErrorMessage(
                        `Setup failed: ${error instanceof Error ? error.message : String(error)}`
                    );
                }
            }
        );
    }

    private async testConnection(item: HostTreeItem): Promise<void> {
        if (item.type !== 'host') {
            vscode.window.showErrorMessage('Please select a host');
            return;
        }

        const hostConfig = item.data as HostConfig;

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Testing connection to ${hostConfig.name}`,
                cancellable: false
            },
            async (progress) => {
                progress.report({ message: 'Connecting...' });

                try {
                    const startTime = Date.now();
                    const success = await SshConnectionManager.testConnection(hostConfig);
                    const elapsed = Date.now() - startTime;

                    if (success) {
                        vscode.window.showInformationMessage(
                            `✓ Connection to "${hostConfig.name}" successful (${elapsed}ms)`
                        );
                    } else {
                        vscode.window.showErrorMessage(
                            `✗ Connection to "${hostConfig.name}" failed`
                        );
                    }
                } catch (error) {
                    vscode.window.showErrorMessage(
                        `✗ Connection to "${hostConfig.name}" failed: ${error instanceof Error ? error.message : String(error)}`
                    );
                }
            }
        );
    }

    private refresh(): void {
        this.treeProvider.refresh();
        vscode.window.showInformationMessage('Host list refreshed');
    }
}
