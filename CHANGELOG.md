# Change Log

All notable changes to the "Simple SCP" extension will be documented in this file.

## [0.6.0] - 2026-01-10

### Enhanced Features
- Enhanced remote file browser with smart path navigation
- Alphabetical sorting (directories first, then files)
- Upload buttons on each directory item for quick uploads
- Download buttons on each file/directory item for quick downloads
- Dot files visibility control via VS Code settings (simpleScp.showDotFiles)
- Temporary toggle for dot files visibility in current session
- Improved UI with simplified descriptions
- New activity bar icon with folder and bidirectional arrows

### UI Improvements
- Removed redundant "double-click" descriptions
- Simplified parent directory indicator ("..")
- Smart path input navigation with trailing slash detection
- Input box shows current path for easy editing
- Refactored code to eliminate duplication between upload and download browsers

### Configuration
- Added simpleScp.showDotFiles setting (default: true)
- Dot files visibility persists across sessions
- Quick toggle available in file browser

## [0.5.0] - 2026-01-09

### Features
- Quick file upload to remote servers via SCP/SFTP
- Host management with TreeView interface
- Multiple authentication methods support (Password, Private Key, SSH Agent)
- Interactive remote path selector with folder navigation
- Import hosts from SSH config file with group selection
- Color-coded hosts for easy identification
- Edit host connection details (address and port)
- Setup passwordless login automatically
- Copy SSH command to clipboard
- Output logs viewer for troubleshooting

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
