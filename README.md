# R Version Switcher

A robust VS Code extension to easily switch between R versions managed by [rig](https://github.com/r-lib/rig) (R Installation Manager). Works seamlessly across Windows, macOS, and Linux.

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/yourusername/r-version-switcher)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

## Features

✅ **Cross-Platform Support** - Works on Windows, macOS, and Linux  
✅ **Intelligent Detection** - Automatically detects all rig-managed R versions  
✅ **Workspace-Specific** - Different R versions per project  
✅ **Safe Operations** - Automatic backup and rollback on failure  
✅ **R Extension Integration** - Seamlessly updates R extension settings  
✅ **Path Validation** - Verifies R installations before switching  
✅ **User-Friendly** - Interactive quick pick menu with current version indicator

## Commands

### R: Switch Version
Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (macOS), type "R: Switch Version", and select your desired R version from the menu.

### R: Show Current Version
Display the currently configured R version for the workspace, including path validation.

## Requirements

### Essential
- [rig (R Installation Manager)](https://github.com/r-lib/rig) must be installed and available in PATH
- [R Extension for VS Code](https://marketplace.visualstudio.com/items?itemName=REditorSupport.r) (recommended)
- At least one R version installed via rig

### Platform-Specific

#### Windows
- PowerShell (comes with Windows)
- R installed in standard location: `C:\Program Files\R\R-{version}\bin\R.exe`

#### macOS
- Supported paths:
  - `/Library/Frameworks/R.framework/Versions/{version}/Resources/bin/R`
  - `/opt/R/{version}/bin/R`

#### Linux
- Supported paths:
  - `/opt/R/{version}/bin/R`
  - `/usr/local/lib/R/{version}/bin/R`

## Installation

### From VS Code Marketplace (Coming Soon)
1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "R Version Switcher"
4. Click Install

### Manual Installation
1. Download the `.vsix` file from [Releases](https://github.com/yourusername/r-version-switcher/releases)
2. Open VS Code
3. Go to Extensions (Ctrl+Shift+X)
4. Click the "..." menu → "Install from VSIX..."
5. Select the downloaded file

### Development Installation
1. Clone this repository
2. Copy to `%USERPROFILE%\.vscode\extensions\` (Windows) or `~/.vscode/extensions/` (macOS/Linux)
3. Restart VS Code

## Usage

### Basic Workflow

1. **Open a workspace or folder** in VS Code
2. **Press `Ctrl+Shift+P`** to open the Command Palette
3. **Type "R: Switch Version"** and press Enter
4. **Select your desired R version** from the quick pick menu
   - Current version is marked with a checkmark ✓
5. **Workspace settings are updated automatically**
6. **Restart your R terminal** for changes to take effect

### Checking Current Version

Run `R: Show Current Version` to see:
- Current R version configured for the workspace
- Full path to R executable
- Validation status (✓ Valid or ✗ Invalid path)

## How It Works

The extension:

1. **Validates environment** - Checks rig is installed and R extension is available
2. **Executes `rig list`** - Retrieves all installed R versions
3. **Validates paths** - Verifies each R executable exists
4. **Updates settings** - Modifies workspace `.vscode/settings.json`:
   - `r.rpath.windows` / `r.rpath.mac` / `r.rpath.linux` - Platform-specific R path
   - `r.rterm.option` - Adds/updates `--r-binary` parameter
5. **Verifies changes** - Confirms settings were updated correctly
6. **Rolls back on failure** - Restores previous settings if update fails

**Note:** Both commands (`Switch Version` and `Show Current Version`) validate that the R extension is installed before proceeding. You can choose to "Continue Anyway" if you want to configure settings without the R extension installed, though this is not recommended.

## Settings Modified

This extension modifies the following workspace settings:

```json
{
  "r.rpath.windows": "C:\\Program Files\\R\\R-4.5.1\\bin\\R.exe",
  "r.rterm.option": [
    "--r-binary=C:\\Program Files\\R\\R-4.5.1\\bin\\R.exe"
  ]
}
```

Settings are workspace-scoped and won't sync across machines, allowing different R versions per environment.

## Troubleshooting

### "rig is not installed or not in PATH"

**Solution:**
1. Install rig from [r-lib/rig](https://github.com/r-lib/rig#installation)
2. Ensure rig is in your system PATH
3. Restart VS Code after installation

**Verify installation:**
```bash
rig list
```

### "No R versions found"

**Possible causes:**
- No R versions installed via rig
- R installed in non-standard locations
- Platform detection mismatch

**Solutions:**
1. Install R using rig: `rig add release` or `rig add 4.5.1`
2. Verify installation: `rig list`
3. Check installation paths match expected locations (see Requirements section)

### "Failed to execute 'rig list'"

**Possible causes:**
- rig not in PATH
- Permission issues
- Shell access problems

**Solutions:**
1. Run `rig list` manually in terminal to verify it works
2. Check PATH environment variable
3. On Windows: Ensure PowerShell execution policy allows scripts
4. Restart VS Code after PATH changes

### "R extension is not installed"

**Solution:**
Install the official [R Extension](https://marketplace.visualstudio.com/items?itemName=REditorSupport.r) from the VS Code Marketplace.

**Alternative:**
If you want to configure R settings without installing the R extension (not recommended), you can choose "Continue Anyway" when prompted. However, these settings are designed to work with the R extension, so functionality will be limited.

**Why is this required?**
The R Version Switcher configures settings specifically for the R extension (`r.rpath.*` and `r.rterm.option`). Without the R extension, these settings have no effect.

### "Settings update verification failed"

**Possible causes:**
- Workspace folder is read-only
- Settings.json is corrupted
- Insufficient permissions

**Solutions:**
1. Check folder permissions
2. Manually verify `.vscode/settings.json` is writable
3. Try closing and reopening the workspace

### Invalid Path Warning

If you see "✗ Invalid path" in Show Current Version:
1. The configured R path no longer exists
2. Re-run "R: Switch Version" to select a valid version
3. Or manually edit `.vscode/settings.json`

## Known Limitations

- Only detects R versions installed via rig
- Requires standard installation paths (see Requirements)
- Portable R installations not supported
- Changes require R terminal restart (not automatic)

## Development

### Building from Source

```bash
# Clone repository
git clone https://github.com/yourusername/r-version-switcher.git
cd r-version-switcher

# Install dependencies
npm install

# Run tests
npm test

# Package extension
npm run package
```

### Running Tests

```bash
npm test
```

Tests cover:
- Platform detection
- Rig output parsing
- Path validation
- Settings management
- Error scenarios

### Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass (`npm test`)
6. Commit changes (`git commit -m 'Add amazing feature'`)
7. Push to branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## Changelog

### 1.0.0 (2026-02-04)

**Initial Release**

- ✨ Cross-platform support (Windows, macOS, Linux)
- ✨ Interactive R version switching
- ✨ Show current version command
- ✨ Automatic rig detection with helpful error messages
- ✨ R extension validation
- ✨ Settings backup and rollback
- ✨ Async file operations
- ✨ Command execution timeout (10s)
- ✨ Comprehensive error handling
- ✨ Path validation before switching
- ✨ Support for multiple R path locations per platform
- 🧪 Complete test suite

## License

[MIT License](LICENSE) - see LICENSE file for details

## Acknowledgments

- [rig](https://github.com/r-lib/rig) - R Installation Manager by r-lib
- [R Extension for VS Code](https://github.com/REditorSupport/vscode-R) - Official R language support
- VS Code Extension API documentation

## Support

- 🐛 [Report bugs](https://github.com/yourusername/r-version-switcher/issues)
- 💡 [Request features](https://github.com/yourusername/r-version-switcher/issues)
- 📖 [Read documentation](https://github.com/yourusername/r-version-switcher#readme)
- ⭐ [Star on GitHub](https://github.com/yourusername/r-version-switcher)

---

**Enjoy seamless R version switching! 🎉**
