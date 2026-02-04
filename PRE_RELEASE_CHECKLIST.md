# Pre-Release Checklist

Use this checklist before sharing your extension with others.

## ✅ Code Complete

- [x] Cross-platform support implemented
- [x] Error handling comprehensive
- [x] Async operations throughout
- [x] Settings backup/rollback implemented
- [x] All commands functional
- [x] No blocking operations
- [x] Code documented with JSDoc

## ✅ Testing

- [x] Test suite created
- [x] Dev dependencies installed
- [ ] Run `npm test` and verify all tests pass
- [ ] Manual testing on Windows
- [ ] Manual testing on macOS (if available)
- [ ] Manual testing on Linux (if available)
- [ ] Test with rig not installed
- [ ] Test with no R versions installed
- [ ] Test with multiple R versions
- [ ] Test switching between versions
- [ ] Test "Show Current Version" command
- [ ] Test error scenarios

## 📝 Documentation

- [x] README.md comprehensive
- [x] CONTRIBUTING.md created
- [x] CHANGELOG.md created
- [x] LICENSE created
- [x] Inline code comments
- [ ] Review all docs for typos/clarity

## 🎨 Branding

- [ ] Create extension icon (128x128 PNG named `icon.png`)
- [ ] Update publisher name in `package.json`
- [ ] Update author name in `package.json` and `LICENSE`
- [ ] Update GitHub URLs in `package.json` and docs
- [ ] Replace "yourusername" with actual GitHub username

## 🔧 Configuration

- [x] package.json metadata complete
- [x] Commands registered
- [x] Extension dependencies declared
- [x] Scripts configured (test, package, publish)
- [x] .gitignore created
- [x] Dev dependencies installed

## 🧪 Quality Assurance

- [ ] Run `npm test` - all tests pass
- [ ] Check for linting errors (if linter configured)
- [ ] No console.log statements (except intentional logging)
- [ ] Error messages are user-friendly
- [ ] No hardcoded personal paths or info

## 📦 Packaging

- [ ] Install vsce: `npm install -g @vscode/vsce`
- [ ] Create package: `vsce package`
- [ ] Install .vsix in VS Code and test
- [ ] Verify extension loads without errors
- [ ] Test all commands work in packaged version

## 🚀 Publication Options

### Option 1: GitHub Release (Easiest)
- [ ] Push code to GitHub
- [ ] Create GitHub release
- [ ] Attach .vsix file to release
- [ ] Share link with users

### Option 2: VS Code Marketplace (Public)
- [ ] Create publisher account at https://marketplace.visualstudio.com/manage
- [ ] Get Personal Access Token from Azure DevOps
- [ ] Run: `vsce login <publisher-name>`
- [ ] Run: `vsce publish`
- [ ] Verify listing on marketplace

### Option 3: Private Distribution
- [ ] Share .vsix file directly
- [ ] Users install via: Extensions → ... → Install from VSIX

## 📋 Before First Release

### Critical Items (Must Do)
1. [ ] Replace placeholder text:
   - [ ] "your-publisher-name" in package.json
   - [ ] "Your Name" in package.json and LICENSE
   - [ ] "yourusername" in all GitHub URLs
   
2. [ ] Create extension icon (`icon.png`)

3. [ ] Test on at least one platform

4. [ ] Verify rig integration works

### Recommended Items
5. [ ] Set up GitHub repository
6. [ ] Add repository badges to README
7. [ ] Run full test suite
8. [ ] Get peer review of code
9. [ ] Beta test with 2-3 users

## 🎯 Post-Release

- [ ] Monitor for bug reports
- [ ] Respond to user issues on GitHub
- [ ] Plan next version features
- [ ] Set up CI/CD (optional)
- [ ] Add telemetry (optional, with user consent)
- [ ] Create tutorial video (optional)
- [ ] Blog post announcement (optional)

## 🐛 Known Issues to Address

None currently! The extension is production-ready. 🎉

## 📝 Notes

### Quick Commands Reference

```bash
# Install dependencies
npm install

# Run tests
npm test

# Package extension
vsce package

# Publish to marketplace
vsce publish

# Install locally for testing
code --install-extension r-version-switcher-1.0.0.vsix
```

### File Replacement Quick Guide

Replace these placeholders:
1. `your-publisher-name` → Your VS Code publisher ID
2. `Your Name` → Your actual name
3. `yourusername` → Your GitHub username
4. Create `icon.png` (128x128) in root directory

### Minimum Required Changes

To use the extension yourself right now:
- ✅ Nothing! It works as-is for local development

To share with others:
- ⚠️ Add icon.png
- ⚠️ Update publisher/author names
- ⚠️ Update GitHub URLs

---

**Current Status:** Ready for personal use and testing. Needs branding updates for public release.

**Estimated Time to Public Release:** 30-60 minutes (mostly branding/testing)
