const assert = require('assert');

const {
    legacyRPathSetting,
    rigLinkName,
    findExecutable,
    executableSettingFor,
    settingMatchesEntry,
    withRBinary,
    workspaceRSettings
} = require('../../lib/settings');
const { extractVersionFromPath } = require('../../lib/versions');

const WINDOWS_ENTRY = {
    name: '4.5.1',
    version: '4.5.1',
    binary: 'C:\\Program Files\\R\\R-4.5.1\\bin\\R.exe'
};

suite('legacyRPathSetting', () => {
    test('names the deprecated setting for each platform', () => {
        assert.strictEqual(legacyRPathSetting('win32'), 'rpath.windows');
        assert.strictEqual(legacyRPathSetting('darwin'), 'rpath.mac');
        assert.strictEqual(legacyRPathSetting('linux'), 'rpath.linux');
    });
});

suite('rigLinkName', () => {
    test('uses the rig name, so arch-specific installs keep their suffix', () => {
        assert.strictEqual(rigLinkName('4.5.1', 'linux'), 'R-4.5.1');
        assert.strictEqual(rigLinkName('4.5-arm64', 'darwin'), 'R-4.5-arm64');
    });

    test('adds .exe on Windows, where "R-4.5.1" would look like it has an extension', () => {
        assert.strictEqual(rigLinkName('4.5.1', 'win32'), 'R-4.5.1.exe');
    });

    test('link names still give the version back', () => {
        assert.strictEqual(extractVersionFromPath(rigLinkName('4.5.1', 'linux')), '4.5.1');
        assert.strictEqual(extractVersionFromPath(rigLinkName('4.5.1', 'win32')), '4.5.1');
    });
});

suite('findExecutable', () => {
    test('finds a Windows executable through PATHEXT, case-insensitively', () => {
        const files = new Set(['c:\\program files\\r\\bin\\r-4.5.1.exe']);
        const found = findExecutable('R-4.5.1', {
            pathEnv: 'C:\\Windows;C:\\Program Files\\R\\bin',
            pathExt: '.COM;.EXE',
            platform: 'win32',
            isFile: candidate => files.has(candidate.toLowerCase())
        });
        assert.strictEqual(found, 'C:\\Program Files\\R\\bin\\R-4.5.1.exe');
    });

    test('uses a name that already ends in an executable extension as given', () => {
        const found = findExecutable('R-4.5.1.exe', {
            pathEnv: 'C:\\Program Files\\R\\bin',
            pathExt: '.COM;.EXE',
            platform: 'win32',
            isFile: candidate => candidate === 'C:\\Program Files\\R\\bin\\R-4.5.1.exe'
        });
        assert.strictEqual(found, 'C:\\Program Files\\R\\bin\\R-4.5.1.exe');
    });

    test('finds a POSIX executable without extensions', () => {
        const found = findExecutable('R-4.5.1', {
            pathEnv: '/usr/bin:/usr/local/bin',
            platform: 'linux',
            isFile: candidate => candidate === '/usr/local/bin/R-4.5.1'
        });
        assert.strictEqual(found, '/usr/local/bin/R-4.5.1');
    });

    test('returns null when the executable is not on PATH', () => {
        const found = findExecutable('R-9.9.9', {
            pathEnv: 'C:\\Windows',
            platform: 'win32',
            isFile: () => false
        });
        assert.strictEqual(found, null);
    });
});

suite('executableSettingFor', () => {
    test('prefers the rig link when it is on PATH', () => {
        const onPath = name => name === 'R-4.5.1.exe' ? 'C:\\x\\R-4.5.1.exe' : null;
        assert.strictEqual(executableSettingFor(WINDOWS_ENTRY, onPath, 'win32'), 'R-4.5.1.exe');
    });

    test('falls back to the full path without the link', () => {
        assert.strictEqual(executableSettingFor(WINDOWS_ENTRY, () => null, 'win32'), WINDOWS_ENTRY.binary);
    });
});

suite('settingMatchesEntry', () => {
    test('matches the full path and the rig link name', () => {
        assert.ok(settingMatchesEntry(WINDOWS_ENTRY.binary, WINDOWS_ENTRY, 'win32'));
        assert.ok(settingMatchesEntry('R-4.5.1.exe', WINDOWS_ENTRY, 'win32'));
        assert.ok(settingMatchesEntry('R-4.5.1', WINDOWS_ENTRY, 'win32'));
    });

    test('ignores case, .exe and quotes on Windows', () => {
        assert.ok(settingMatchesEntry('r-4.5.1.EXE', WINDOWS_ENTRY, 'win32'));
        assert.ok(settingMatchesEntry(`"${WINDOWS_ENTRY.binary}"`, WINDOWS_ENTRY, 'win32'));
    });

    test('does not match another version or an empty setting', () => {
        assert.ok(!settingMatchesEntry('R-4.5.2', WINDOWS_ENTRY, 'win32'));
        assert.ok(!settingMatchesEntry(undefined, WINDOWS_ENTRY, 'win32'));
    });

    test('is case-sensitive on POSIX', () => {
        const entry = { name: '4.5.1', binary: '/opt/R/4.5.1/bin/R' };
        assert.ok(settingMatchesEntry('R-4.5.1', entry, 'linux'));
        assert.ok(!settingMatchesEntry('r-4.5.1', entry, 'linux'));
    });
});

suite('withRBinary', () => {
    test('adds --r-binary and keeps other arguments', () => {
        assert.deepStrictEqual(withRBinary(['--no-save'], 'R-4.5.1'), ['--no-save', '--r-binary=R-4.5.1']);
    });

    test('replaces an existing --r-binary in place and drops duplicates', () => {
        assert.deepStrictEqual(
            withRBinary(['--r-binary=old', '--quiet', '--r-binary=older'], 'R-4.5.1'),
            ['--r-binary=R-4.5.1', '--quiet']
        );
    });

    test('starts from an empty list for missing or invalid input', () => {
        assert.deepStrictEqual(withRBinary(undefined, 'R-4.5.1'), ['--r-binary=R-4.5.1']);
        assert.deepStrictEqual(withRBinary('--quiet', 'R-4.5.1'), ['--r-binary=R-4.5.1']);
    });

    test('does not change the input array', () => {
        const args = ['--quiet'];
        withRBinary(args, 'R-4.5.1');
        assert.deepStrictEqual(args, ['--quiet']);
    });
});

suite('workspaceRSettings', () => {
    const args = ['--no-save', '--r-binary=R-4.5.1.exe'];

    test('writes the new settings and removes the deprecated ones', () => {
        assert.deepStrictEqual(workspaceRSettings('R-4.5.1.exe', args, { platform: 'win32' }), [
            ['executablePath', 'R-4.5.1.exe'],
            ['consoleArgs', args],
            ['rpath.windows', undefined],
            ['rterm.option', undefined]
        ]);
    });

    test('keeps r.rpath.<platform> in sync with r.executablePath for R Debugger', () => {
        const updates = new Map(workspaceRSettings('R-4.5.1', args, { syncLegacyRPath: true, platform: 'linux' }));
        assert.strictEqual(updates.get('rpath.linux'), 'R-4.5.1');
        assert.strictEqual(updates.get('executablePath'), 'R-4.5.1');
        assert.ok(updates.has('rterm.option') && updates.get('rterm.option') === undefined);
    });
});
