# Change Log

All notable changes to the "Simple SCP" extension will be documented in this file.

## [0.5.0] - 2026-01-09

### Features
- 🚀 Quick file upload to remote servers via SCP/SFTP
- 🖥️ Host management with TreeView interface
- 🔐 Multiple authentication methods support (Password, Private Key, SSH Agent)
- 📁 Interactive remote path selector with folder navigation
- 📝 Import hosts from SSH config file with group selection
- 🎨 Color-coded hosts for easy identification
- ⚙️ Edit host connection details (address and port)
- 🔑 Setup passwordless login automatically
- 📋 Copy SSH command to clipboard
- 📊 Output logs viewer for troubleshooting

### Authentication
- Separate authentication storage for security (local only, not synced)
- Visual indicators for configured authentication status
- Windows SSH Agent support via named pipes

### User Experience
- Upload files from Explorer or Editor context menu
- Theme-aware folder icons in path selector
- Clean command palette with essential commands only
- Progress indicators for long-running operations
- Real-time SSH config import with progress tracking

### Platform Support
- Windows, macOS, and Linux compatible
- Cross-platform SSH Agent integration
- Synced host configurations across devices
