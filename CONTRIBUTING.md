# Contributing to R Version Switcher

Thank you for considering contributing to R Version Switcher! This document provides guidelines and instructions for contributing.

## Code of Conduct

Be respectful, inclusive, and professional in all interactions.

## How to Contribute

### Reporting Bugs

Before creating a bug report:
1. Check [existing issues](https://github.com/yourusername/r-version-switcher/issues)
2. Verify you're using the latest version
3. Test with minimal configuration

When creating a bug report, include:
- **Clear title** describing the issue
- **Steps to reproduce** the problem
- **Expected behavior** vs actual behavior
- **VS Code version** (Help → About)
- **Extension version**
- **Operating system** and version
- **rig version** (`rig --version`)
- **Error messages** from Output panel (View → Output → R Version Switcher)
- **Relevant configuration** from `.vscode/settings.json`

### Suggesting Features

Feature requests should include:
- **Use case** - Why is this feature needed?
- **Proposed solution** - How should it work?
- **Alternatives considered** - Other ways to solve the problem
- **Platform considerations** - Does it work cross-platform?

### Pull Requests

#### Before Starting

1. Check [existing issues](https://github.com/yourusername/r-version-switcher/issues) for related work
2. For major changes, open an issue first to discuss
3. Fork the repository

#### Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/r-version-switcher.git
cd r-version-switcher

# Install dependencies
npm install

# Open in VS Code
code .
```

#### Making Changes

1. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow existing code style
   - Add comments for complex logic
   - Keep functions focused and small

3. **Add tests**
   - Add unit tests for new functionality
   - Update existing tests if behavior changes
   - Ensure all tests pass: `npm test`

4. **Test manually**
   - Press F5 to launch Extension Development Host
   - Test all affected commands
   - Test on different platforms if possible
   - Test error scenarios

5. **Update documentation**
   - Update README.md if user-facing changes
   - Add inline JSDoc comments
   - Update CHANGELOG.md

6. **Commit changes**
   ```bash
   git add .
   git commit -m "feat: Add your feature description"
   ```

   Use conventional commit format:
   - `feat:` - New feature
   - `fix:` - Bug fix
   - `docs:` - Documentation only
   - `test:` - Adding/updating tests
   - `refactor:` - Code refactoring
   - `perf:` - Performance improvement
   - `chore:` - Maintenance tasks

7. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```
   
   Then create a Pull Request on GitHub.

#### PR Guidelines

Your PR should:
- Have a clear title and description
- Reference related issues (Closes #123)
- Include tests for new functionality
- Pass all existing tests
- Update documentation as needed
- Follow existing code style
- Work cross-platform (Windows, macOS, Linux)

**PR Template:**

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Manually tested on Windows
- [ ] Manually tested on macOS
- [ ] Manually tested on Linux

## Checklist
- [ ] Code follows project style
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] All tests pass
- [ ] No new warnings

## Related Issues
Closes #123
```

## Code Style

### JavaScript

- Use `const` for constants, `let` for variables
- Use async/await over promises
- Use template literals for string interpolation
- Add JSDoc comments for functions
- Use descriptive variable names
- Keep functions under 50 lines when possible

**Example:**

```javascript
/**
 * Check if R executable exists at given path
 * @param {string} rPath - Path to R executable
 * @returns {Promise<boolean>} True if exists
 */
async function checkRExists(rPath) {
    try {
        await fsPromises.access(rPath, fs.constants.F_OK);
        return true;
    } catch {
        return false;
    }
}
```

### Error Handling

- Always handle errors gracefully
- Provide actionable error messages
- Log errors with context
- Consider rollback for failed operations

### Testing

- Write tests for new functionality
- Test error scenarios
- Use descriptive test names
- Keep tests independent

## Project Structure

```
r-version-switcher/
├── extension.js          # Main extension code
├── package.json          # Extension manifest
├── README.md            # User documentation
├── CONTRIBUTING.md      # This file
├── CHANGELOG.md         # Version history
├── LICENSE              # MIT license
├── test/
│   ├── extension.test.js # Test suite
│   └── runTest.js       # Test runner
└── .vscode/
    └── launch.json      # Debug configuration
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- --grep "Platform Detection"
```

### Writing Tests

```javascript
suite('Feature Name Tests', () => {
    test('Should do something specific', () => {
        // Arrange
        const input = 'test';
        
        // Act
        const result = someFunction(input);
        
        // Assert
        assert.strictEqual(result, expected);
    });
});
```

## Platform Considerations

When adding features, ensure cross-platform compatibility:

### Path Handling
- Use `path.join()` for paths
- Test on Windows (backslashes) and Unix (forward slashes)
- Consider drive letters on Windows

### Shell Commands
- Windows uses PowerShell by default
- macOS/Linux use bash/sh
- Set `shell` parameter appropriately

### File Operations
- Use async file operations (`fs.promises`)
- Handle permission errors
- Consider case sensitivity (Linux/macOS vs Windows)

## Release Process

(For maintainers)

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Commit: `git commit -m "chore: Release v1.x.x"`
4. Tag: `git tag v1.x.x`
5. Push: `git push && git push --tags`
6. Package: `npm run package`
7. Publish: `npm run publish`

## Questions?

Open an [issue](https://github.com/yourusername/r-version-switcher/issues) or discussion for questions.

Thank you for contributing! 🎉
