const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vscode = require('vscode');

const EXTENSION_ID = 'OndrejMottl.r-version-switcher';
const COMMANDS = [
    'r.switchVersion',
    'r.showCurrentVersion',
    'r.addVersion',
    'r.removeVersion',
    'r.setDefaultVersion',
    'r.installRtools',
    'r.useRenvVersion'
];

function getWorkspacePath() {
    return vscode.workspace.workspaceFolders[0].uri.fsPath;
}

function legacyRPathSetting() {
    if (process.platform === 'win32') return 'rpath.windows';
    if (process.platform === 'darwin') return 'rpath.mac';
    return 'rpath.linux';
}

// What the extension writes for an installed R: rig's version link when it
// is on PATH, the full path otherwise.
function expectedExecutable(entry) {
    const link = process.platform === 'win32' ? `R-${entry.name}.exe` : `R-${entry.name}`;
    return rigModule.findOnPath(link) ? link : entry.binary;
}

let rigModule;

suite('Extension', () => {
    let internals;
    let activated;

    suiteSetup(async () => {
        const extension = vscode.extensions.getExtension(EXTENSION_ID);
        assert.ok(extension, `${EXTENSION_ID} is not loaded`);
        activated = await extension.activate();
        // Same module instance the extension host loaded.
        internals = require(path.join(extension.extensionPath, 'extension.js'));
        rigModule = require(path.join(extension.extensionPath, 'lib', 'rig.js'));
    });

    test('registers all commands', async () => {
        const commands = await vscode.commands.getCommands(true);
        for (const command of COMMANDS) {
            assert.ok(commands.includes(command), `${command} is not registered`);
        }
    });

    test('runs rig as a task and reports its exit code', async () => {
        assert.strictEqual(await internals.runRigTask('rig version', ['--version']), 0);
        assert.notStrictEqual(await internals.runRigTask('rig bad', ['no-such-command']), 0);
    });

    test('r.useRenvVersion points workspace settings at the renv.lock version', async () => {
        const installed = await internals.getInstalledVersions();
        assert.ok(installed.length > 0, 'needs at least one R installed via rig');
        // Pick a version that is not the first one, so the switch is visible.
        const target = installed[installed.length - 1];

        fs.writeFileSync(
            path.join(getWorkspacePath(), 'renv.lock'),
            JSON.stringify({ R: { Version: target.version }, Packages: {} })
        );
        await vscode.commands.executeCommand('r.useRenvVersion');

        const config = vscode.workspace.getConfiguration('r');
        const expected = expectedExecutable(target);
        assert.strictEqual(config.get('executablePath'), expected);
        assert.ok(
            config.get('consoleArgs').includes(`--r-binary=${expected}`),
            'consoleArgs has no matching --r-binary'
        );
    });

    test('switching replaces the deprecated settings and keeps other console arguments', async () => {
        const installed = await internals.getInstalledVersions();
        const target = installed[0];
        const config = vscode.workspace.getConfiguration('r');
        const workspace = vscode.ConfigurationTarget.Workspace;
        await config.update('executablePath', undefined, workspace);
        await config.update('consoleArgs', undefined, workspace);
        await config.update(legacyRPathSetting(), target.binary, workspace);
        await config.update('rterm.option', ['--quiet', '--r-binary=old'], workspace);

        fs.writeFileSync(
            path.join(getWorkspacePath(), 'renv.lock'),
            JSON.stringify({ R: { Version: target.version }, Packages: {} })
        );
        await vscode.commands.executeCommand('r.useRenvVersion');

        const updated = vscode.workspace.getConfiguration('r');
        const expected = expectedExecutable(target);
        assert.strictEqual(updated.get('executablePath'), expected);
        assert.deepStrictEqual(updated.get('consoleArgs'), ['--quiet', `--r-binary=${expected}`]);
        assert.strictEqual(updated.inspect(legacyRPathSetting()).workspaceValue, undefined);
        assert.strictEqual(updated.inspect('rterm.option').workspaceValue, undefined);
    });

    test('quick pick, Show Current Version and status bar understand a rig link name', async () => {
        const installed = await internals.getInstalledVersions();
        assert.ok(installed.length > 1, 'needs at least two R versions installed via rig');
        const target = installed[installed.length - 1];
        const other = installed[0];
        const writeLock = version => fs.writeFileSync(
            path.join(getWorkspacePath(), 'renv.lock'),
            JSON.stringify({ R: { Version: version }, Packages: {} })
        );

        writeLock(target.version);
        const expected = expectedExecutable(target);
        await vscode.workspace.getConfiguration('r')
            .update('executablePath', expected, vscode.ConfigurationTarget.Workspace);

        // Capture what the user would see instead of waiting for input.
        const original = {
            showQuickPick: vscode.window.showQuickPick,
            showInformationMessage: vscode.window.showInformationMessage
        };
        let pickItems;
        const messages = [];
        vscode.window.showQuickPick = async items => { pickItems = await items; return undefined; };
        vscode.window.showInformationMessage = async message => { messages.push(message); return undefined; };
        try {
            await vscode.commands.executeCommand('r.switchVersion');
            await vscode.commands.executeCommand('r.showCurrentVersion');
        } finally {
            Object.assign(vscode.window, original);
        }

        const ticked = pickItems.filter(item => item.label.startsWith('$(check)'));
        assert.deepStrictEqual(ticked.map(item => item.entry.name), [target.name]);
        assert.match(ticked[0].description, /this workspace/);
        assert.match(ticked[0].description, /renv\.lock/);

        const current = messages.find(message => message.startsWith('Current R version'));
        assert.ok(current, `no Show Current Version message in ${JSON.stringify(messages)}`);
        assert.ok(current.includes(`Current R version: ${target.version} ✓ Valid.`), current);
        if (expected !== target.binary) {
            // A link name is shown with the file it resolves to.
            assert.ok(current.includes(`Path: ${expected} (`), current);
        }

        const statusBar = activated.getStatusBarItem();
        await activated.refreshStatusBar();
        assert.strictEqual(statusBar.text, `$(versions) R ${target.version}`);
        assert.strictEqual(statusBar.backgroundColor, undefined);

        writeLock(other.version);
        await activated.refreshStatusBar();
        assert.strictEqual(statusBar.text, `$(versions) R ${target.version} $(warning) renv ${other.version}`);
        assert.ok(statusBar.backgroundColor instanceof vscode.ThemeColor);
        assert.strictEqual(statusBar.backgroundColor.id, 'statusBarItem.warningBackground');
    });
});
