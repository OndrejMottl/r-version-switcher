# Changelog

All notable changes to the "R Version Switcher" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
- 🔮 Status bar indicator showing current R version
- 🔮 Quick switch between recently used R versions
- 🔮 Support for custom R installation paths
- 🔮 Integration with R project files (`.Rproj`, `renv.lock`)
- 🔮 R version suggestions based on project requirements
- 🔮 Option to set default/global R version
- 🔮 R version comparison tool
- 🔮 Automatic R version detection from Docker containers

### Under Consideration
- Extension icon design
- Telemetry for anonymous usage analytics
- Marketplace publication
- CI/CD pipeline setup
- Performance optimizations for large installations

---

## Version History

- **1.0.0** (2026-02-04) - Initial release

---

## How to Update

To update to the latest version:

1. **From Marketplace:** VS Code will notify you of updates automatically
2. **Manual:** Download the latest `.vsix` from [Releases](https://github.com/yourusername/r-version-switcher/releases)

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
- 🐛 [Report issues](https://github.com/yourusername/r-version-switcher/issues)
- 💡 [Request features](https://github.com/yourusername/r-version-switcher/issues/new)
- 📖 [Read docs](https://github.com/yourusername/r-version-switcher#readme)
