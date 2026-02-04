const vscode = require('vscode');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

const execAsync = promisify(exec);
const fsPromises = fs.promises;

// Platform detection
const IS_WINDOWS = process.platform === 'win32';
const IS_MACOS = process.platform === 'darwin';
const IS_LINUX = process.platform === 'linux';

// Command execution timeout
const EXEC_TIMEOUT = 10000; // 10 seconds

/**
 * Check if rig is installed and available
 */
async function checkRigInstalled() {
    try {
        const shell = IS_WINDOWS ? 'powershell.exe' : undefined;
        const testCommand = IS_WINDOWS ? 'Get-Command rig -ErrorAction SilentlyContinue' : 'which rig';
        await execAsync(testCommand, { shell, timeout: EXEC_TIMEOUT });
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Get R installation path based on platform
 */
function getRPath(version) {
    if (IS_WINDOWS) {
        return `C:\\Program Files\\R\\R-${version}\\bin\\R.exe`;
    } else if (IS_MACOS) {
        // Check both common locations on macOS
        return [
            `/Library/Frameworks/R.framework/Versions/${version}/Resources/bin/R`,
            `/opt/R/${version}/bin/R`
        ];
    } else if (IS_LINUX) {
        return [
            `/opt/R/${version}/bin/R`,
            `/usr/local/lib/R/${version}/bin/R`
        ];
    }
    return null;
}

/**
 * Check if R executable exists (async)
 */
async function checkRExists(rPath) {
    try {
        await fsPromises.access(rPath, fs.constants.F_OK);
        return true;
    } catch {
        return false;
    }
}

/**
 * Get platform-specific R path setting name
 */
function getRPathSettingName() {
    if (IS_WINDOWS) return 'rpath.windows';
    if (IS_MACOS) return 'rpath.mac';
    if (IS_LINUX) return 'rpath.linux';
    return 'rpath.windows'; // fallback
}

/**
 * Check if R extension is installed and prompt user if not
 * @returns {Promise<boolean>} True if R extension is installed, false otherwise
 */
async function checkRExtensionInstalled() {
    const rExtension = vscode.extensions.getExtension('REditorSupport.r');
    if (!rExtension) {
        const result = await vscode.window.showWarningMessage(
            'R extension is not installed. This extension configures R extension settings.',
            'Install R Extension',
            'Continue Anyway'
        );
        if (result === 'Install R Extension') {
            vscode.env.openExternal(vscode.Uri.parse('vscode:extension/REditorSupport.r'));
        }
        return result === 'Continue Anyway';
    }
    return true;
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log('R Version Switcher extension is now active');

    // Command: Switch Version
    let switchCommand = vscode.commands.registerCommand('r.switchVersion', async () => {
        try {
            // Check if a workspace is open
            if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
                vscode.window.showErrorMessage('Please open a folder or workspace first to set project-specific R version.');
                return;
            }

            // Check if rig is installed
            const rigInstalled = await checkRigInstalled();
            if (!rigInstalled) {
                const result = await vscode.window.showErrorMessage(
                    'rig (R Installation Manager) is not installed or not in PATH.',
                    'Learn More'
                );
                if (result === 'Learn More') {
                    vscode.env.openExternal(vscode.Uri.parse('https://github.com/r-lib/rig#installation'));
                }
                return;
            }

            // Check if R extension is installed
            const rExtensionInstalled = await checkRExtensionInstalled();
            if (!rExtensionInstalled) {
                return;
            }

            // Execute rig list command
            vscode.window.showInformationMessage('Fetching available R versions...');
            
            let stdout;
            try {
                const shell = IS_WINDOWS ? 'powershell.exe' : undefined;
                const result = await execAsync('rig list', { 
                    shell, 
                    timeout: EXEC_TIMEOUT,
                    maxBuffer: 1024 * 1024 // 1MB buffer
                });
                stdout = result.stdout;
                
                if (!stdout || stdout.trim().length === 0) {
                    vscode.window.showErrorMessage('rig returned empty output. Make sure R versions are installed via rig.');
                    return;
                }
            } catch (error) {
                if (error.code === 'ETIMEDOUT') {
                    vscode.window.showErrorMessage('rig command timed out. Please try again.');
                } else {
                    vscode.window.showErrorMessage(`Failed to execute 'rig list': ${error.message}. Make sure rig is installed and in your PATH.`);
                }
                return;
            }

            // Parse rig list output
            const lines = stdout.split('\n');
            const versions = [];
            let currentVersion = null;

            for (const line of lines) {
                const trimmed = line.trim();
                
                // Skip header lines and separator lines
                if (trimmed.startsWith('*') && trimmed.includes('name')) continue;
                if (trimmed.startsWith('---')) continue;
                if (trimmed === '') continue;

                // Extract version number
                let version = '';
                let isCurrent = false;

                if (line.startsWith('*')) {
                    // Current version (marked with *)
                    isCurrent = true;
                    // Extract version: "* 4.5.1" or "* 4.5.1           release"
                    const match = line.match(/^\*\s+(\d+\.\d+\.\d+)/);
                    if (match) {
                        version = match[1];
                        currentVersion = version;
                    }
                } else {
                    // Other versions: "  3.5.0" or "  4.5.2           release"
                    const match = line.match(/^\s+(\d+\.\d+\.\d+)/);
                    if (match) {
                        version = match[1];
                    }
                }

                if (version) {
                    // Construct the R executable path(s)
                    const rPathCandidates = getRPath(version);
                    const pathsToCheck = Array.isArray(rPathCandidates) ? rPathCandidates : [rPathCandidates];
                    
                    // Verify path exists (async)
                    for (const rPath of pathsToCheck) {
                        if (await checkRExists(rPath)) {
                            versions.push({
                                label: isCurrent ? `$(check) R ${version} (current)` : `R ${version}`,
                                description: rPath,
                                version: version,
                                path: rPath,
                                isCurrent: isCurrent
                            });
                            break; // Use first valid path found
                        }
                    }
                }
            }

            if (versions.length === 0) {
                const platform = IS_WINDOWS ? 'Windows' : IS_MACOS ? 'macOS' : 'Linux';
                vscode.window.showErrorMessage(
                    `No R versions found for ${platform}. Make sure R is installed via rig and the installation paths are standard.`
                );
                return;
            }

            // Show quick pick menu
            const selected = await vscode.window.showQuickPick(versions, {
                placeHolder: 'Select R version for this workspace',
                title: 'R Version Switcher'
            });

            if (!selected) {
                return; // User cancelled
            }

            // Backup current settings for rollback
            const config = vscode.workspace.getConfiguration('r');
            const rPathSetting = getRPathSettingName();
            const previousRPath = config.get(rPathSetting);
            const previousRtermOptions = config.get('rterm.option') || [];
            const rPath = selected.path;
            
            try {
                // Update platform-specific r.rpath setting
                await config.update(rPathSetting, rPath, vscode.ConfigurationTarget.Workspace);
                
                // Update r.rterm.option to update the --r-binary parameter
                const currentOptions = config.get('rterm.option') || [];
                const newOptions = Array.isArray(currentOptions) ? [...currentOptions] : [];
                
                const binaryIndex = newOptions.findIndex(opt => 
                    typeof opt === 'string' && opt.startsWith('--r-binary=')
                );
                
                if (binaryIndex >= 0) {
                    newOptions[binaryIndex] = `--r-binary=${rPath}`;
                } else {
                    newOptions.push(`--r-binary=${rPath}`);
                }
                
                await config.update('rterm.option', newOptions, vscode.ConfigurationTarget.Workspace);

                // Verify settings were updated
                const updatedConfig = vscode.workspace.getConfiguration('r');
                const verifyPath = updatedConfig.get(rPathSetting);
                if (verifyPath !== rPath) {
                    throw new Error('Settings update verification failed');
                }

                vscode.window.showInformationMessage(
                    `R version switched to ${selected.version} for this workspace. Restart R terminal for changes to take effect.`
                );
                
            } catch (updateError) {
                // Rollback on failure
                vscode.window.showErrorMessage(`Failed to update settings: ${updateError.message}. Rolling back...`);
                try {
                    if (previousRPath !== undefined) {
                        await config.update(rPathSetting, previousRPath, vscode.ConfigurationTarget.Workspace);
                    }
                    if (previousRtermOptions.length > 0) {
                        await config.update('rterm.option', previousRtermOptions, vscode.ConfigurationTarget.Workspace);
                    }
                    vscode.window.showInformationMessage('Settings rolled back to previous values.');
                } catch (rollbackError) {
                    vscode.window.showErrorMessage(`Rollback failed: ${rollbackError.message}. You may need to manually fix settings.`);
                }
            }

        } catch (error) {
            vscode.window.showErrorMessage(`Error: ${error.message}`);
            console.error('R Version Switcher error:', error);
        }
    });

    // Command: Show Current Version
    let showVersionCommand = vscode.commands.registerCommand('r.showCurrentVersion', async () => {
        try {
            if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
                vscode.window.showInformationMessage('No workspace open. Current R version is system default.');
                return;
            }

            // Check if R extension is installed
            const rExtensionInstalled = await checkRExtensionInstalled();
            if (!rExtensionInstalled) {
                return;
            }

            const config = vscode.workspace.getConfiguration('r');
            const rPathSetting = getRPathSettingName();
            const rPath = config.get(rPathSetting);

            if (!rPath) {
                vscode.window.showInformationMessage('No R version configured for this workspace. Using system default.');
                return;
            }

            // Extract version from path
            const versionMatch = rPath.match(/R[\-\/](\d+\.\d+\.\d+)/);
            const version = versionMatch ? versionMatch[1] : 'unknown';

            // Verify R executable exists
            const exists = await checkRExists(rPath);
            const status = exists ? '\u2713 Valid' : '\u2717 Invalid path';

            vscode.window.showInformationMessage(
                `Current R version: ${version} ${status}\nPath: ${rPath}`
            );

        } catch (error) {
            vscode.window.showErrorMessage(`Error: ${error.message}`);
            console.error('Show current version error:', error);
        }
    });

    context.subscriptions.push(switchCommand, showVersionCommand);
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
