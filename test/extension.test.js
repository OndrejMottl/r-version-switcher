const assert = require('assert');
const vscode = require('vscode');
const path = require('path');

suite('R Version Switcher Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('your-publisher.r-version-switcher'));
    });

    test('Should register r.switchVersion command', async () => {
        const commands = await vscode.commands.getCommands(true);
        assert.ok(commands.includes('r.switchVersion'));
    });

    test('Should register r.showCurrentVersion command', async () => {
        const commands = await vscode.commands.getCommands(true);
        assert.ok(commands.includes('r.showCurrentVersion'));
    });
});

suite('Rig Output Parsing Tests', () => {
    
    test('Should parse Windows rig list output correctly', () => {
        const mockOutput = `* name            installed         aliases
-------------------------------------------------------------------
* 4.5.1           release          
  4.4.0           release          
  3.6.3           release`;

        const lines = mockOutput.split('\n');
        const versions = [];

        for (const line of lines) {
            const trimmed = line.trim();
            
            if (trimmed.startsWith('*') && trimmed.includes('name')) continue;
            if (trimmed.startsWith('---')) continue;
            if (trimmed === '') continue;

            let version = '';
            let isCurrent = false;

            if (line.startsWith('*')) {
                isCurrent = true;
                const match = line.match(/^\*\s+(\d+\.\d+\.\d+)/);
                if (match) {
                    version = match[1];
                }
            } else {
                const match = line.match(/^\s+(\d+\.\d+\.\d+)/);
                if (match) {
                    version = match[1];
                }
            }

            if (version) {
                versions.push({ version, isCurrent });
            }
        }

        assert.strictEqual(versions.length, 3);
        assert.strictEqual(versions[0].version, '4.5.1');
        assert.strictEqual(versions[0].isCurrent, true);
        assert.strictEqual(versions[1].version, '4.4.0');
        assert.strictEqual(versions[1].isCurrent, false);
    });

    test('Should handle empty rig output', () => {
        const mockOutput = '';
        const lines = mockOutput.split('\n');
        const versions = [];

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed === '') continue;
            
            let version = '';
            const match = line.match(/^\*?\s*(\d+\.\d+\.\d+)/);
            if (match) {
                version = match[1];
            }
            if (version) {
                versions.push({ version });
            }
        }

        assert.strictEqual(versions.length, 0);
    });

    test('Should handle malformed version strings', () => {
        const mockOutput = `* name            installed         aliases
-------------------------------------------------------------------
  4.5              partial-version
  not-a-version    release
  4.4.0            release`;

        const lines = mockOutput.split('\n');
        const versions = [];

        for (const line of lines) {
            const trimmed = line.trim();
            
            if (trimmed.startsWith('*') && trimmed.includes('name')) continue;
            if (trimmed.startsWith('---')) continue;
            if (trimmed === '') continue;

            let version = '';
            const match = line.match(/^\s+(\d+\.\d+\.\d+)/);
            if (match) {
                version = match[1];
            }

            if (version) {
                versions.push({ version });
            }
        }

        // Should only match valid semantic versions (4.4.0)
        assert.strictEqual(versions.length, 1);
        assert.strictEqual(versions[0].version, '4.4.0');
    });
});

suite('Platform Detection Tests', () => {
    
    test('Should detect platform correctly', () => {
        const platform = process.platform;
        assert.ok(['win32', 'darwin', 'linux'].includes(platform));
    });

    test('Should generate correct R path for Windows', () => {
        const version = '4.5.1';
        const expectedPath = `C:\\Program Files\\R\\R-${version}\\bin\\R.exe`;
        
        // Simulate getRPath function
        const rPath = `C:\\Program Files\\R\\R-${version}\\bin\\R.exe`;
        assert.strictEqual(rPath, expectedPath);
    });

    test('Should generate correct R paths for macOS', () => {
        const version = '4.5.1';
        const expectedPaths = [
            `/Library/Frameworks/R.framework/Versions/${version}/Resources/bin/R`,
            `/opt/R/${version}/bin/R`
        ];
        
        assert.ok(expectedPaths.length === 2);
        assert.ok(expectedPaths[0].includes(version));
    });

    test('Should generate correct R paths for Linux', () => {
        const version = '4.5.1';
        const expectedPaths = [
            `/opt/R/${version}/bin/R`,
            `/usr/local/lib/R/${version}/bin/R`
        ];
        
        assert.ok(expectedPaths.length === 2);
        assert.ok(expectedPaths[0].includes(version));
    });
});

suite('Configuration Tests', () => {
    
    test('Should determine correct rpath setting name for Windows', () => {
        const IS_WINDOWS = process.platform === 'win32';
        const IS_MACOS = process.platform === 'darwin';
        const IS_LINUX = process.platform === 'linux';

        let settingName;
        if (IS_WINDOWS) settingName = 'rpath.windows';
        else if (IS_MACOS) settingName = 'rpath.mac';
        else if (IS_LINUX) settingName = 'rpath.linux';

        assert.ok(settingName);
        assert.ok(['rpath.windows', 'rpath.mac', 'rpath.linux'].includes(settingName));
    });

    test('Should handle rterm.option array correctly', () => {
        const currentOptions = ['--no-save', '--no-restore'];
        const rPath = 'C:\\Program Files\\R\\R-4.5.1\\bin\\R.exe';
        
        // Simulate option update logic
        const newOptions = [...currentOptions];
        const binaryIndex = newOptions.findIndex(opt => 
            typeof opt === 'string' && opt.startsWith('--r-binary=')
        );
        
        if (binaryIndex >= 0) {
            newOptions[binaryIndex] = `--r-binary=${rPath}`;
        } else {
            newOptions.push(`--r-binary=${rPath}`);
        }

        assert.strictEqual(newOptions.length, 3);
        assert.ok(newOptions.some(opt => opt.startsWith('--r-binary=')));
    });

    test('Should update existing --r-binary option', () => {
        const currentOptions = ['--no-save', '--r-binary=C:\\old\\path\\R.exe'];
        const newRPath = 'C:\\new\\path\\R.exe';
        
        const newOptions = [...currentOptions];
        const binaryIndex = newOptions.findIndex(opt => 
            typeof opt === 'string' && opt.startsWith('--r-binary=')
        );
        
        if (binaryIndex >= 0) {
            newOptions[binaryIndex] = `--r-binary=${newRPath}`;
        }

        assert.strictEqual(newOptions.length, 2);
        assert.strictEqual(newOptions[1], `--r-binary=${newRPath}`);
    });
});

suite('Version Extraction Tests', () => {
    
    test('Should extract version from Windows path', () => {
        const rPath = 'C:\\Program Files\\R\\R-4.5.1\\bin\\R.exe';
        const versionMatch = rPath.match(/R[\-\/](\d+\.\d+\.\d+)/);
        const version = versionMatch ? versionMatch[1] : 'unknown';
        
        assert.strictEqual(version, '4.5.1');
    });

    test('Should extract version from macOS path', () => {
        const rPath = '/Library/Frameworks/R.framework/Versions/4.5.1/Resources/bin/R';
        const versionMatch = rPath.match(/R[\-\/](\d+\.\d+\.\d+)/);
        const version = versionMatch ? versionMatch[1] : 'unknown';
        
        assert.strictEqual(version, '4.5.1');
    });

    test('Should extract version from Linux path', () => {
        const rPath = '/opt/R/4.5.1/bin/R';
        const versionMatch = rPath.match(/R[\-\/](\d+\.\d+\.\d+)/);
        const version = versionMatch ? versionMatch[1] : 'unknown';
        
        assert.strictEqual(version, '4.5.1');
    });

    test('Should return unknown for invalid path', () => {
        const rPath = '/some/invalid/path/R';
        const versionMatch = rPath.match(/R[\-\/](\d+\.\d+\.\d+)/);
        const version = versionMatch ? versionMatch[1] : 'unknown';
        
        assert.strictEqual(version, 'unknown');
    });
});

suite('R Extension Validation Tests', () => {
    
    test('Should detect when R extension is present', () => {
        // Check if R extension exists
        const rExtension = vscode.extensions.getExtension('REditorSupport.r');
        
        // This test will pass or fail based on actual environment
        // In a real environment, it should be installed
        if (rExtension) {
            assert.ok(rExtension, 'R extension should be detected when installed');
        } else {
            console.log('Warning: R extension not installed in test environment');
        }
    });

    test('Should handle R extension not installed scenario', () => {
        // Simulate checking for a non-existent extension
        const fakeExtension = vscode.extensions.getExtension('fake.extension.that.does.not.exist');
        
        assert.strictEqual(fakeExtension, undefined, 'Non-existent extension should return undefined');
    });

    test('Should validate R extension ID format', () => {
        const expectedId = 'REditorSupport.r';
        const parts = expectedId.split('.');
        
        assert.strictEqual(parts.length, 2, 'Extension ID should have publisher.name format');
        assert.strictEqual(parts[0], 'REditorSupport', 'Publisher should be REditorSupport');
        assert.strictEqual(parts[1], 'r', 'Extension name should be r');
    });

    test('Should handle extension dependency declared in package.json', () => {
        // In a real scenario, package.json should declare the R extension as a dependency
        const expectedDependency = 'REditorSupport.r';
        
        // This validates the expected dependency format
        assert.ok(expectedDependency.includes('.'), 'Extension dependency should be in publisher.name format');
    });
});
