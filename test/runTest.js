// Run the integration tests in a downloaded VS Code instance
const path = require('path');
const fs = require('fs');
const os = require('os');
const cp = require('child_process');

const {
    downloadAndUnzipVSCode,
    resolveCliArgsFromVSCodeExecutablePath,
    runTests
} = require('@vscode/test-electron');

async function main() {
    // Set when started from inside VS Code (e.g. an extension's terminal);
    // it would make the test instance start as plain Node.
    delete process.env.ELECTRON_RUN_AS_NODE;

    const extensionDevelopmentPath = path.resolve(__dirname, '..');
    const extensionTestsPath = path.resolve(__dirname, 'integration', 'index.js');
    const workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), 'rvs-workspace-'));

    try {
        const vscodeExecutablePath = await downloadAndUnzipVSCode('stable');

        // The extension declares vscode-R as a dependency; without it VS Code
        // refuses to activate the extension under test.
        const [cli, ...args] = resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath);
        cp.spawnSync(cli, [...args, '--install-extension', 'REditorSupport.r'], {
            encoding: 'utf-8',
            stdio: 'inherit',
            shell: process.platform === 'win32'
        });

        await runTests({
            vscodeExecutablePath,
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs: [workspacePath]
        });
    } catch (error) {
        console.error('Failed to run tests:', error);
        process.exitCode = 1;
    } finally {
        fs.rmSync(workspacePath, { recursive: true, force: true });
    }
}

main();
