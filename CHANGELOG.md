# Changelog

All notable changes to the "R Version Switcher" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-11-09

### Changed
- Writes `r.executablePath` and `r.consoleArgs` (vscode-R 3.x) instead of the deprecated `r.rpath.<platform>` and `r.rterm.option`. Switching a workspace removes the deprecated settings; `R: Use R Version from renv.lock` also rewrites a workspace that already uses the right version through them.
- If R Debugger is installed, `r.rpath.<platform>` is kept and set to the same value as `r.executablePath`, since R Debugger reads only that setting and would otherwise start the first R on `PATH`.
- Uses rig's version link on `PATH` (`R-4.5.1.exe` on Windows, `R-4.5.1` elsewhere) instead of the full path to `R.exe` when the link exists, so `.vscode/settings.json` holds no install path and can be committed.
- Keeps the console arguments already in effect (your own, the ones in the deprecated `r.rterm.option`, or vscode-R's default) and only sets `--r-binary`.
- Rollback restores the workspace values only, instead of copying user settings into the workspace.
- Repository links and author in `package.json`, `LICENSE`, README, CONTRIBUTING and CHANGELOG.

### Fixed
- `R: Show Current Version` resolves a version link on `PATH` instead of reporting it as an invalid path.

## [1.1.0] - 2026-10-25

### Added
- `R: Add Version` installs an R version with `rig add`: the latest release, `next`, `devel`, the newest patch of each minor version, or any version you type (e.g. `4.4.1`, `4.4`, `oldrel/2`). Afterwards it offers to use the new version in the workspace and to install the Rtools it needs.
- `R: Remove Version` removes one or more R versions with `rig rm`, with a confirmation that warns when the workspace or the system default uses them.
- `R: Set System Default Version` sets the R version used outside VS Code (`rig default`).
- `R: Install Rtools` (Windows) works out which Rtools each installed R version needs and installs the missing ones.
- `R: Use R Version from renv.lock` switches the workspace to the R version in `renv.lock`, or offers to install it (or to use the newest installed patch of the same minor version).
- On startup and when `renv.lock` changes, a warning appears if the workspace R version differs from `renv.lock` (setting `rVersionSwitcher.checkRenvLock`).
- Status bar item showing the workspace R version, with a warning when it differs from `renv.lock` (setting `rVersionSwitcher.showStatusBar`).
- rig commands that change installations run as VS Code tasks, so their output and any administrator (UAC) prompt are visible.
- Extension icon.

### Changed
- rig is run directly instead of through PowerShell, which fails on some Windows machines.
- R executables are taken from `rig list --json` instead of guessed paths, so rig user-mode installs (rig 0.10+) are found.
- The JSON printed by rig 0.7 on Windows (unescaped backslashes, trailing commas) is repaired before parsing.
- Requires VS Code 1.64 or higher.
- Tests: `npm test` runs unit tests of the rig, renv and version helpers in Node; `npm run test:integration` runs the extension in a downloaded VS Code.

### Fixed
- The timeout message for rig commands is shown (a timeout sets `error.killed`, not `error.code`).
- Command titles no longer show the category twice ("R: R: Switch Version").

## [1.0.0] - 2026-02-04

### Added
- ✨ Initial release of R Version Switcher
- ✨ `R: Switch Version` command to switch between R versions
- ✨ `R: Show Current Version` command to display current R configuration
- ✨ Cross-platform support for Windows, macOS, and Linux
- ✨ Automatic rig (R Installation Manager) detection and validation
- ✨ R Extension for VS Code integration and validation **on every command execution**
- ✨ Option to "Continue Anyway" if R extension is not installed (advanced users)
- ✨ Interactive quick pick menu showing all installed R versions
- ✨ Current version indicator (✓) in version selection menu
- ✨ Async file operations for non-blocking path validation
- ✨ Command execution timeout (10 seconds) to prevent hanging
- ✨ Settings backup and automatic rollback on failure
- ✨ Platform-specific R path detection:
  - Windows: `C:\Program Files\R\R-{version}\bin\R.exe`
  - macOS: `/Library/Frameworks/...` and `/opt/R/...`
  - Linux: `/opt/R/...` and `/usr/local/lib/R/...`
- ✨ Comprehensive error handling with actionable user messages
- ✨ Helpful error messages with links to installation guides
- ✨ Settings verification after updates
- ✨ Support for multiple R installation paths per platform
- 🧪 Complete test suite covering:
  - Extension commands registration
  - Rig output parsing (various formats)
  - Platform detection and path generation
  - Configuration management
  - Version extraction from paths
  - **R extension validation**
  - Error scenarios
- 📖 Comprehensive documentation:
  - Detailed README with troubleshooting
  - Contributing guidelines
  - Change log
  - Inline code documentation

### Technical Details
- Workspace-scoped settings (not synced across machines)
- Updates both `r.rpath.{platform}` and `r.rterm.option` settings
- Non-blocking async operations throughout
- Graceful degradation with helpful error messages
- No external npm dependencies (except dev dependencies)

### Requirements
- VS Code 1.60.0 or higher
- rig (R Installation Manager) installed and in PATH
- R Extension for VS Code (recommended)
- At least one R version installed via rig

---

## [Unreleased]

### Planned
- 🔮 Automatic R terminal restart after version switch
- 🔮 Hint when a newer patch release of the workspace R version is available
- 🔮 Quick switch between recently used R versions
- 🔮 Support for custom R installation paths
- 🔮 R version comparison tool
- 🔮 Automatic R version detection from Docker containers

### Under Consideration
- Telemetry for anonymous usage analytics
- Marketplace publication
- CI/CD pipeline setup
- Performance optimizations for large installations

---

## Version History

- **1.1.0** (2026-10-25) - Add, remove, default and Rtools commands; renv.lock support; status bar
- **1.0.0** (2026-02-04) - Initial release

---

## How to Update

To update to the latest version:

1. **From Marketplace:** VS Code will notify you of updates automatically
2. **Manual:** Download the latest `.vsix` from [Releases](https://github.com/OndrejMottl/r-version-switcher/releases)

---

## Migration Guide

### From "Vibe Coded" Version to 1.0.0

**Breaking Changes:**
- None - First official release

**New Features:**
- Cross-platform support (was Windows-only)
- Rig installation validation
- R extension validation
- Settings backup/rollback
- Show current version command
- Comprehensive error handling

**What You Need to Do:**
- Nothing! The extension works the same way but with better error handling
- Optionally run `R: Show Current Version` to verify your setup

---

## Support

Found a bug or have a feature request?
- 🐛 [Report issues](https://github.com/OndrejMottl/r-version-switcher/issues)
- 💡 [Request features](https://github.com/OndrejMottl/r-version-switcher/issues/new)
- 📖 [Read docs](https://github.com/OndrejMottl/r-version-switcher#readme)
