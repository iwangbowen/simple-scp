# Simple SCP

A lightweight VS Code extension for uploading files to remote hosts via SCP/SFTP with cross-device host configuration synchronization.

## Features

- Cross-device sync: Synchronize host configurations across devices using VS Code's globalStorage
- SSH config import: Import existing host configurations from ~/.ssh/config
- Passwordless login: Configure passwordless login with ssh-copy-id-like functionality
- File upload: Upload individual files and folders to remote hosts
- Smart path selection: Browse remote directories dynamically with QuickPick interface
- Progress display: Real-time upload progress indication
- Group management: Organize hosts into groups

## Usage

### Add Host

1. Click the "Simple SCP" icon in the sidebar
2. Click the "+" button to add a new host
3. Enter host information (name, address, port, username, etc.)

### Import SSH Config

1. Click the "Import from SSH Config" button
2. Select the host configurations to import

### Upload Files

1. Right-click a file or folder in the explorer
2. Select "Upload to Remote Host"
3. Choose the target host
4. Select the remote path

### Configure Passwordless Login

1. Right-click a host in the host list
2. Select "Setup Passwordless Login"
3. Follow the prompts to complete the setup

## Requirements

- VS Code 1.85.0 or higher

## Extension Settings

This extension does not contribute any settings.

## Known Issues

None

## Release Notes

### 0.0.1

Initial release

## Development

```bash
# Install dependencies
npm install

# Compile
npm run compile

# Watch mode
npm run watch
```
