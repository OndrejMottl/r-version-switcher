const vscode = require('vscode');
const fs = require('fs');

const rig = require('./lib/rig');
const { readRenvVersion } = require('./lib/renv');
const {
    compareVersions,
    extractVersionFromPath,
    findBestMatch
} = require('./lib/versions');
const {
    EXECUTABLE_SETTING,
    CONSOLE_ARGS_SETTING,
    LEGACY_CONSOLE_ARGS_SETTING,
    legacyRPathSetting,
    executableSettingFor,
    settingMatchesEntry,
    withRBinary
} = require('./lib/settings');

// Platform detection
const IS_WINDOWS = process.platform === 'win32';
const IS_MACOS = process.platform === 'darwin';
const IS_LINUX = process.platform === 'linux';

const SETTINGS_SECTION = 'rVersionSwitcher';
const TASK_TYPE = 'rig';

let statusBarItem;

/**
 * Get R installation path based on platform. Only used when rig does not
 * report the binary itself.
 */
function getRPath(version) {
    if (IS_WINDOWS) {
        return [`C:\\Program Files\\R\\R-${version}\\bin\\R.exe`];
    } else if (IS_MACOS) {
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
    return [];
}

/**
 * Check if R executable exists (async)
 */
async function checkRExists(rPath) {
    try {
        await fs.promises.access(rPath, fs.constants.F_OK);
        return true;
    } catch {
        return false;
    }
}

/**
 * Resolve a configured R executable to a file: a bare name such as
 * "R-4.5.1" is looked up on PATH, as vscode-R does
 * @param {string} rPath
 * @returns {Promise<string|null>}
 */
async function resolveConfiguredR(rPath) {
    if (!rPath) return null;
    if (!/[\\/]/.test(rPath)) return rig.findOnPath(rPath);
    return await checkRExists(rPath) ? rPath : null;
}

function getWorkspaceFolder() {
    const folders = vscode.workspace.workspaceFolders;
    return folders && folders.length > 0 ? folders[0] : undefined;
}

/**
 * The R executable configured for vscode-R: `r.executablePath`, or the
 * deprecated `r.rpath.<platform>` that older versions of this extension
 * wrote.
 * @returns {{rPath: string|undefined, setting: string|undefined, version: string|null, isWorkspace: boolean}}
 */
function getConfiguredR() {
    const config = vscode.workspace.getConfiguration('r');
    for (const setting of [EXECUTABLE_SETTING, legacyRPathSetting(process.platform)]) {
        const rPath = config.get(setting) || undefined;
        if (!rPath) continue;
        const inspected = config.inspect(setting) || {};
        return {
            rPath,
            setting,
            version: extractVersionFromPath(rPath),
            isWorkspace: Boolean(inspected.workspaceValue || inspected.workspaceFolderValue)
        };
    }
    return { rPath: undefined, setting: undefined, version: null, isWorkspace: false };
}

/**
 * Check whether the configured R is this installed version
 */
function isConfigured(entry, configured) {
    return settingMatchesEntry(configured.rPath, entry, process.platform);
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
 * Check that rig is available and tell the user how to get it if not
 * @returns {Promise<boolean>}
 */
async function ensureRig() {
    if (await rig.getRigVersion()) return true;

    const result = await vscode.window.showErrorMessage(
        'rig (R Installation Manager) is not installed or not in PATH.',
        'Learn More'
    );
    if (result === 'Learn More') {
        vscode.env.openExternal(vscode.Uri.parse('https://github.com/r-lib/rig#installation'));
    }
    return false;
}

/**
 * Run an async step behind a progress notification
 */
function withProgress(title, task) {
    return vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title },
        task
    );
}

/**
 * List installed R versions whose executable exists. Uses the binary path
 * reported by rig, so rig user-mode installs are found too.
 */
async function getInstalledVersions() {
    const installed = await rig.listInstalled();
    const result = [];

    for (const entry of installed) {
        const candidates = entry.binary ? [entry.binary] : getRPath(entry.version);
        for (const rPath of candidates) {
            if (await checkRExists(rPath)) {
                result.push({ ...entry, binary: rPath });
                break; // Use first valid path found
            }
        }
    }
    return result;
}

/**
 * Describe an installed version for a quick pick item
 */
function describeInstalled(entry, configured, renvVersion) {
    const tags = [];
    if (isConfigured(entry, configured)) tags.push('this workspace');
    if (entry.isDefault) tags.push('system default');
    if (renvVersion && entry.version === renvVersion) tags.push('renv.lock');
    return tags.length > 0 ? `(${tags.join(', ')})` : '';
}

/**
 * Point the workspace R settings at an installed R, rolling back on failure.
 *
 * Writes `r.executablePath` (language server, help) and `--r-binary` in
 * `r.consoleArgs` (radian). Both use rig's version link (e.g. "R-4.5.1")
 * when it is on PATH, so the settings file holds no install path. The
 * deprecated `r.rpath.<platform>` and `r.rterm.option` are removed from the
 * workspace settings.
 * @param {{name: string, version: string, binary: string}} entry
 * @returns {Promise<boolean>}
 */
async function applyRVersion(entry) {
    const config = vscode.workspace.getConfiguration('r');
    const legacyRPath = legacyRPathSetting(process.platform);
    const touched = [EXECUTABLE_SETTING, CONSOLE_ARGS_SETTING, legacyRPath, LEGACY_CONSOLE_ARGS_SETTING];

    // Backup the workspace values (not the merged ones) for rollback
    const previous = new Map(touched.map(key => [key, (config.inspect(key) || {}).workspaceValue]));

    const rPath = executableSettingFor(entry, rig.findOnPath);
    // Keep the console arguments already in effect: r.consoleArgs if anyone
    // set it, else the deprecated r.rterm.option that older versions wrote,
    // else vscode-R's default.
    const isSet = key => {
        const inspected = config.inspect(key) || {};
        return [inspected.globalValue, inspected.workspaceValue, inspected.workspaceFolderValue]
            .some(value => value !== undefined);
    };
    const argsSource = !isSet(CONSOLE_ARGS_SETTING) && isSet(LEGACY_CONSOLE_ARGS_SETTING)
        ? LEGACY_CONSOLE_ARGS_SETTING
        : CONSOLE_ARGS_SETTING;
    const consoleArgs = withRBinary(config.get(argsSource), rPath);

    try {
        const target = vscode.ConfigurationTarget.Workspace;
        await config.update(EXECUTABLE_SETTING, rPath, target);
        await config.update(CONSOLE_ARGS_SETTING, consoleArgs, target);
        for (const key of [legacyRPath, LEGACY_CONSOLE_ARGS_SETTING]) {
            if (previous.get(key) !== undefined) await config.update(key, undefined, target);
        }

        const verifyPath = vscode.workspace.getConfiguration('r').get(EXECUTABLE_SETTING);
        if (verifyPath !== rPath) {
            throw new Error('Settings update verification failed');
        }

        vscode.window.showInformationMessage(
            `R version switched to ${entry.version} for this workspace. Restart the R terminal for the change to take effect.`
        );
        return true;

    } catch (updateError) {
        vscode.window.showErrorMessage(`Failed to update settings: ${updateError.message}. Rolling back...`);
        try {
            for (const [key, value] of previous) {
                await config.update(key, value, vscode.ConfigurationTarget.Workspace);
            }
            vscode.window.showInformationMessage('Settings rolled back to previous values.');
        } catch (rollbackError) {
            vscode.window.showErrorMessage(`Rollback failed: ${rollbackError.message}. You may need to manually fix settings.`);
        }
        return false;
    }
}

/**
 * Run rig as a VS Code task, so its output (and any UAC prompt it raises
 * through gsudo) is visible. rig is started directly, without a shell.
 * @param {string} title
 * @param {string[]} args
 * @returns {Promise<number|undefined>} Exit code of rig
 */
async function runRigTask(title, args) {
    const task = new vscode.Task(
        { type: TASK_TYPE, args },
        getWorkspaceFolder() || vscode.TaskScope.Workspace,
        title,
        'R Version Switcher',
        new vscode.ProcessExecution(rig.resolveRigExecutable(), args)
    );
    task.presentationOptions = {
        reveal: vscode.TaskRevealKind.Always,
        panel: vscode.TaskPanelKind.Dedicated,
        clear: true
    };

    // Collect end events from the start: a fast process can finish before
    // executeTask() has returned its execution object.
    const ended = new Map();
    let execution;
    let resolveExit;
    const exitCode = new Promise(resolve => { resolveExit = resolve; });

    const listener = vscode.tasks.onDidEndTaskProcess(event => {
        if (execution && event.execution === execution) {
            resolveExit(event.exitCode);
        } else {
            ended.set(event.execution, event.exitCode);
        }
    });

    try {
        execution = await vscode.tasks.executeTask(task);
        if (ended.has(execution)) resolveExit(ended.get(execution));
        return await exitCode;
    } finally {
        listener.dispose();
    }
}

/**
 * Report a failed rig task
 */
function showTaskFailure(command, exitCode) {
    vscode.window.showErrorMessage(
        `'rig ${command}' failed (exit code ${exitCode}). See the terminal output for details.`
    );
}

/**
 * Install an R version with `rig add` and return the installed entry
 * @param {string} spec Version or symbolic name, e.g. "4.6.1" or "devel"
 * @param {string} [expectedVersion] Version the spec resolves to
 * @returns {Promise<object|null>}
 */
async function installRVersion(spec, expectedVersion) {
    const before = new Set((await getInstalledVersions()).map(entry => entry.name));

    const exitCode = await runRigTask(`Install R ${spec}`, ['add', spec]);
    if (exitCode !== 0) {
        showTaskFailure(`add ${spec}`, exitCode);
        return null;
    }

    const after = await getInstalledVersions();
    refreshStatusBar();
    return after.find(entry => !before.has(entry.name)) ||
        after.find(entry => entry.version === expectedVersion) ||
        null;
}

/**
 * After a successful install, offer to use the new version here and to
 * install the Rtools it needs
 */
async function offerAfterInstall(entry) {
    const actions = [];
    if (getWorkspaceFolder()) actions.push('Use in This Workspace');

    let missingRtools = null;
    if (IS_WINDOWS) {
        try {
            const needs = rig.computeRtoolsNeeds(
                await rig.listRtoolsAvailable(),
                [entry],
                await rig.listRtoolsInstalled()
            );
            missingRtools = needs.find(need => !need.isInstalled) || null;
        } catch {
            // Rtools detection is a convenience; ignore failures.
        }
    }
    if (missingRtools) actions.push(`Install Rtools ${missingRtools.rtools}`);

    const choice = await vscode.window.showInformationMessage(
        `R ${entry.version} is installed.`,
        ...actions
    );
    if (choice === 'Use in This Workspace') {
        if (await applyRVersion(entry)) refreshStatusBar();
    } else if (missingRtools && choice === `Install Rtools ${missingRtools.rtools}`) {
        await installRtools([missingRtools.rtools]);
    }
}

/**
 * Install Rtools versions one at a time (`rig add` takes one at a time)
 * @param {string[]} rtoolsVersions e.g. ["44", "45"]
 */
async function installRtools(rtoolsVersions) {
    const installed = [];
    for (const version of rtoolsVersions) {
        const exitCode = await runRigTask(`Install Rtools ${version}`, ['add', `rtools${version}`]);
        if (exitCode !== 0) {
            showTaskFailure(`add rtools${version}`, exitCode);
            break;
        }
        installed.push(version);
    }
    if (installed.length > 0) {
        vscode.window.showInformationMessage(`Installed Rtools ${installed.join(', ')}.`);
    }
}

// Command: Switch Version
async function switchVersion() {
    const folder = getWorkspaceFolder();
    if (!folder) {
        vscode.window.showErrorMessage('Please open a folder or workspace first to set project-specific R version.');
        return;
    }
    if (!await ensureRig()) return;
    if (!await checkRExtensionInstalled()) return;

    const [versions, renv] = await withProgress(
        'Fetching available R versions...',
        () => Promise.all([getInstalledVersions(), readRenvVersion(folder.uri.fsPath)])
    );

    if (versions.length === 0) {
        vscode.window.showErrorMessage('No R versions found. Make sure R is installed via rig.');
        return;
    }

    const configured = getConfiguredR();
    const items = versions.map(entry => ({
        label: isConfigured(entry, configured) ? `$(check) R ${entry.version}` : `R ${entry.version}`,
        description: describeInstalled(entry, configured, renv && renv.version),
        detail: entry.binary,
        entry
    }));

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select R version for this workspace',
        title: 'R Version Switcher'
    });
    if (!selected) return; // User cancelled

    if (await applyRVersion(selected.entry)) refreshStatusBar();
}

// Command: Show Current Version
async function showCurrentVersion() {
    const folder = getWorkspaceFolder();
    if (!folder) {
        vscode.window.showInformationMessage('No workspace open. Current R version is system default.');
        return;
    }

    // Check if R extension is installed
    if (!await checkRExtensionInstalled()) return;

    const configured = getConfiguredR();
    if (!configured.rPath) {
        vscode.window.showInformationMessage('No R version configured for this workspace. Using system default.');
        return;
    }

    // Verify R executable exists (a bare rig link name is looked up on PATH)
    const resolved = await resolveConfiguredR(configured.rPath);
    const status = resolved ? '\u2713 Valid' : '\u2717 Invalid path';
    const renv = await readRenvVersion(folder.uri.fsPath);
    const renvNote = renv ? ` renv.lock: R ${renv.version}.` : '';
    const where = resolved && resolved !== configured.rPath
        ? `${configured.rPath} (${resolved})`
        : configured.rPath;

    vscode.window.showInformationMessage(
        `Current R version: ${configured.version || 'unknown'} ${status}.${renvNote}\nPath: ${where}`
    );
}

// Command: Add Version
async function addVersion() {
    if (!await ensureRig()) return;

    let available;
    let installed;
    try {
        [available, installed] = await withProgress(
            'Fetching R versions available from rig...',
            () => Promise.all([rig.listAvailable(), getInstalledVersions()])
        );
    } catch (error) {
        vscode.window.showErrorMessage(error.message);
        return;
    }

    const installedVersions = new Set(installed.map(entry => entry.version));
    const toItem = (entry, label) => ({
        label,
        description: [
            installedVersions.has(entry.version) ? 'installed' : '',
            entry.date ? `released ${entry.date}` : ''
        ].filter(Boolean).join(' \u00b7 '),
        spec: entry.name,
        version: entry.version
    });

    const releases = available
        .filter(entry => entry.type === 'release')
        .sort((a, b) => compareVersions(b.version, a.version));
    const prereleases = available.filter(entry => entry.type !== 'release');
    const [latest, ...older] = releases;

    const separator = label => ({ label, kind: vscode.QuickPickItemKind.Separator });
    const items = [separator('Latest')];
    if (latest) items.push(toItem(latest, `R ${latest.version} (release)`));
    for (const entry of prereleases) {
        items.push(toItem(entry, `R ${entry.version} (${entry.name}, ${entry.type})`));
    }
    items.push(separator('Newest patch of each minor version'));
    for (const entry of older) items.push(toItem(entry, `R ${entry.version}`));
    items.push(separator(''));
    items.push({
        label: '$(edit) Other version...',
        description: 'Any version, e.g. 4.4.1, 4.4 or oldrel/2',
        spec: null
    });

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select R version to install',
        title: 'R Version Switcher: Add Version'
    });
    if (!selected) return;

    let spec = selected.spec;
    let expectedVersion = selected.version;
    if (spec === null) {
        spec = await vscode.window.showInputBox({
            title: 'R Version Switcher: Add Version',
            prompt: 'R version to install: x.y.z, x.y, release, next, devel or oldrel/n',
            validateInput: value => /^\s*[\w.\/-]+\s*$/.test(value) ? null : 'Enter a version such as 4.4.1'
        });
        if (!spec) return;
        spec = spec.trim();
        expectedVersion = spec;
    }

    const existing = installed.find(entry => entry.version === expectedVersion);
    if (existing) {
        await offerAfterInstall(existing);
        return;
    }

    const entry = await installRVersion(spec, expectedVersion);
    if (entry) await offerAfterInstall(entry);
}

// Command: Remove Version
async function removeVersion() {
    if (!await ensureRig()) return;

    const installed = await withProgress('Fetching installed R versions...', getInstalledVersions);
    if (installed.length === 0) {
        vscode.window.showInformationMessage('No R versions installed via rig.');
        return;
    }

    const configured = getConfiguredR();
    const selected = await vscode.window.showQuickPick(
        installed.map(entry => ({
            label: `R ${entry.version}`,
            description: describeInstalled(entry, configured, null),
            detail: entry.binary,
            entry
        })),
        {
            canPickMany: true,
            placeHolder: 'Select R versions to remove',
            title: 'R Version Switcher: Remove Version'
        }
    );
    if (!selected || selected.length === 0) return;

    const entries = selected.map(item => item.entry);
    const names = entries.map(entry => entry.version).join(', ');
    const warnings = ['rig keeps your package libraries.'];
    if (entries.some(entry => isConfigured(entry, configured))) {
        warnings.push('This workspace is set to use one of these versions.');
    }
    if (entries.some(entry => entry.isDefault)) {
        warnings.push('One of these is the system default; the R command will stop working until you set a new default.');
    }

    const confirm = await vscode.window.showWarningMessage(
        `Remove R ${names}?`,
        { modal: true, detail: warnings.join(' ') },
        'Remove'
    );
    if (confirm !== 'Remove') return;

    const args = ['rm', ...entries.map(entry => entry.name)];
    const exitCode = await runRigTask(`Remove R ${names}`, args);
    if (exitCode !== 0) {
        showTaskFailure(args.join(' '), exitCode);
        return;
    }

    refreshStatusBar();
    if (entries.some(entry => isConfigured(entry, configured))) {
        const choice = await vscode.window.showWarningMessage(
            `Removed R ${names}. This workspace still points to the removed version.`,
            'Switch Version'
        );
        if (choice === 'Switch Version') await switchVersion();
    } else {
        vscode.window.showInformationMessage(`Removed R ${names}.`);
    }
}

// Command: Set System Default Version
async function setDefaultVersion() {
    if (!await ensureRig()) return;

    const installed = await withProgress('Fetching installed R versions...', getInstalledVersions);
    if (installed.length === 0) {
        vscode.window.showInformationMessage('No R versions installed via rig.');
        return;
    }

    const selected = await vscode.window.showQuickPick(
        installed.map(entry => ({
            label: entry.isDefault ? `$(check) R ${entry.version}` : `R ${entry.version}`,
            description: entry.isDefault ? '(system default)' : '',
            detail: entry.binary,
            entry
        })),
        {
            placeHolder: 'Select the system default R version (used outside VS Code)',
            title: 'R Version Switcher: Set System Default'
        }
    );
    if (!selected || selected.entry.isDefault) return;

    const args = ['default', selected.entry.name];
    const exitCode = await runRigTask(`Set default R ${selected.entry.version}`, args);
    if (exitCode !== 0) {
        showTaskFailure(args.join(' '), exitCode);
        return;
    }
    vscode.window.showInformationMessage(
        `System default R is now ${selected.entry.version}. Workspace settings are unchanged.`
    );
}

// Command: Install Rtools
async function installRtoolsCommand() {
    if (!IS_WINDOWS) {
        vscode.window.showInformationMessage('Rtools is only needed on Windows.');
        return;
    }
    if (!await ensureRig()) return;

    let needs;
    try {
        needs = await withProgress('Checking Rtools...', async () => rig.computeRtoolsNeeds(
            await rig.listRtoolsAvailable(),
            await getInstalledVersions(),
            await rig.listRtoolsInstalled()
        ));
    } catch (error) {
        vscode.window.showErrorMessage(error.message);
        return;
    }

    const missing = needs.filter(need => !need.isInstalled);
    if (missing.length === 0) {
        const present = needs.map(need => need.rtools).join(', ');
        vscode.window.showInformationMessage(
            `Your installed R versions already have the Rtools they need${present ? ` (${present})` : ''}.`
        );
        return;
    }

    const selected = await vscode.window.showQuickPick(
        missing.map(need => ({
            label: `Rtools ${need.rtools}`,
            description: `needed by R ${need.rVersions.join(', ')}`,
            picked: true,
            rtools: need.rtools
        })),
        {
            canPickMany: true,
            placeHolder: 'Select Rtools versions to install',
            title: 'R Version Switcher: Install Rtools'
        }
    );
    if (!selected || selected.length === 0) return;

    await installRtools(selected.map(item => item.rtools));
}

/**
 * Bring the workspace in line with the R version in renv.lock
 * @param {boolean} [quiet] Skip messages when there is nothing to do
 */
async function useRenvVersion(quiet = false) {
    const folder = getWorkspaceFolder();
    if (!folder) {
        if (!quiet) vscode.window.showErrorMessage('Please open a folder or workspace first.');
        return;
    }
    const renv = await readRenvVersion(folder.uri.fsPath);
    if (!renv) {
        if (!quiet) vscode.window.showInformationMessage('No renv.lock with an R version found in this workspace.');
        return;
    }
    if (!await ensureRig()) return;

    const installed = await getInstalledVersions();
    const { match, exact } = findBestMatch(installed, renv.version);
    const configured = getConfiguredR();

    if (exact) {
        // A workspace set up through the deprecated settings is rewritten.
        if (isConfigured(match, configured) && configured.setting === EXECUTABLE_SETTING) {
            if (!quiet) vscode.window.showInformationMessage(`This workspace already uses R ${renv.version}, as renv.lock requires.`);
            return;
        }
        if (await applyRVersion(match)) refreshStatusBar();
        return;
    }

    const install = `Install R ${renv.version}`;
    const closest = match ? `Use R ${match.version}` : null;
    const choice = await vscode.window.showWarningMessage(
        `renv.lock requires R ${renv.version}, which is not installed.`,
        ...[install, closest].filter(Boolean)
    );
    if (choice === install) {
        const entry = await installRVersion(renv.version, renv.version);
        if (entry && await applyRVersion(entry)) refreshStatusBar();
    } else if (choice && choice === closest) {
        if (await applyRVersion(match)) refreshStatusBar();
    }
}

/**
 * On startup and when renv.lock changes, warn if the workspace R version
 * differs from the one renv.lock requires
 * @param {vscode.ExtensionContext} context
 */
async function checkRenvMismatch(context) {
    const settings = vscode.workspace.getConfiguration(SETTINGS_SECTION);
    if (!settings.get('checkRenvLock', true)) return;

    const folder = getWorkspaceFolder();
    if (!folder) return;
    const renv = await readRenvVersion(folder.uri.fsPath);
    if (!renv) return;

    let current = getConfiguredR().version;
    if (!current) {
        try {
            const fallback = (await rig.listInstalled()).find(entry => entry.isDefault);
            current = fallback ? fallback.version : null;
        } catch {
            return; // Without rig there is nothing to offer.
        }
    }
    if (!current || current === renv.version) return;

    const dismissedKey = `renvPromptDismissed:${renv.version}:${current}`;
    if (context.workspaceState.get(dismissedKey)) return;

    const fix = `Use R ${renv.version}`;
    const choice = await vscode.window.showWarningMessage(
        `renv.lock requires R ${renv.version}, but this workspace uses R ${current}.`,
        fix,
        "Don't Ask Again"
    );
    if (choice === fix) {
        await useRenvVersion();
    } else if (choice === "Don't Ask Again") {
        await context.workspaceState.update(dismissedKey, true);
    }
}

/**
 * Update the status bar item showing the workspace R version
 */
async function refreshStatusBar() {
    if (!statusBarItem) return;

    const settings = vscode.workspace.getConfiguration(SETTINGS_SECTION);
    const folder = getWorkspaceFolder();
    if (!folder || !settings.get('showStatusBar', true)) {
        statusBarItem.hide();
        return;
    }

    const configured = getConfiguredR();
    const renv = await readRenvVersion(folder.uri.fsPath);
    const editor = vscode.window.activeTextEditor;
    const isREditor = editor && ['r', 'rmd'].includes(editor.document.languageId);

    // Only show in R projects, not in every workspace.
    if (!configured.isWorkspace && !renv && !isREditor) {
        statusBarItem.hide();
        return;
    }

    // The effective setting may come from user settings; that is still the
    // R that vscode-R starts here.
    const current = configured.version ? `R ${configured.version}` : 'R (default)';
    const mismatch = Boolean(renv && configured.version && configured.version !== renv.version);

    statusBarItem.text = mismatch
        ? `$(versions) ${current} $(warning) renv ${renv.version}`
        : `$(versions) ${current}`;
    statusBarItem.backgroundColor = mismatch
        ? new vscode.ThemeColor('statusBarItem.warningBackground')
        : undefined;
    statusBarItem.tooltip = [
        `Workspace R: ${configured.rPath || 'not set (system default)'}`,
        renv ? `renv.lock: R ${renv.version}` : null,
        'Click to switch R version'
    ].filter(Boolean).join('\n');
    statusBarItem.show();
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log('R Version Switcher extension is now active');

    // Wrap each command so unexpected errors reach the user
    const register = (id, handler) => vscode.commands.registerCommand(id, async (...args) => {
        try {
            await handler(...args);
        } catch (error) {
            vscode.window.showErrorMessage(`Error: ${error.message}`);
            console.error(`R Version Switcher error in ${id}:`, error);
        }
    });

    context.subscriptions.push(
        register('r.switchVersion', switchVersion),
        register('r.showCurrentVersion', showCurrentVersion),
        register('r.addVersion', addVersion),
        register('r.removeVersion', removeVersion),
        register('r.setDefaultVersion', setDefaultVersion),
        register('r.installRtools', installRtoolsCommand),
        register('r.useRenvVersion', () => useRenvVersion(false))
    );

    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.name = 'R Version';
    statusBarItem.command = 'r.switchVersion';
    context.subscriptions.push(statusBarItem);

    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('r') || event.affectsConfiguration(SETTINGS_SECTION)) {
                refreshStatusBar();
            }
        }),
        vscode.window.onDidChangeActiveTextEditor(() => refreshStatusBar())
    );

    const folder = getWorkspaceFolder();
    if (folder) {
        const watcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(folder, 'renv.lock')
        );
        const onLockChange = () => {
            refreshStatusBar();
            checkRenvMismatch(context).catch(error => console.error('renv.lock check failed:', error));
        };
        watcher.onDidCreate(onLockChange);
        watcher.onDidChange(onLockChange);
        watcher.onDidDelete(() => refreshStatusBar());
        context.subscriptions.push(watcher);
    }

    refreshStatusBar();
    checkRenvMismatch(context).catch(error => console.error('renv.lock check failed:', error));
}

function deactivate() {}

module.exports = {
    activate,
    deactivate,
    // Exposed for the integration tests
    runRigTask,
    getInstalledVersions
};
