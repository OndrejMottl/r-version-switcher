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

function getRPathSettingName() {
    if (process.platform === 'win32') return 'rpath.windows';
    if (process.platform === 'darwin') return 'rpath.mac';
    return 'rpath.linux';
}

suite('Extension', () => {
    let internals;

    suiteSetup(async () => {
        const extension = vscode.extensions.getExtension(EXTENSION_ID);
        assert.ok(extension, `${EXTENSION_ID} is not loaded`);
        await extension.activate();
        // Same module instance the extension host loaded.
        internals = require(path.join(extension.extensionPath, 'extension.js'));
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
        assert.strictEqual(config.get(getRPathSettingName()), target.binary);
        assert.ok(
            config.get('rterm.option').includes(`--r-binary=${target.binary}`),
            'rterm.option has no matching --r-binary'
        );
    });
});
