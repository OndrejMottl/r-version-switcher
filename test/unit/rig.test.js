const assert = require('assert');

const {
    stripAnsi,
    parseRigJson,
    parseRigVersion,
    normaliseInstalled,
    normaliseAvailable,
    computeRtoolsNeeds,
    getRigVersion,
    listInstalled
} = require('../../lib/rig');

// Verbatim output of rig 0.7.1 on Windows: backslashes are not escaped.
const RIG_071_LIST = `[
  {
    "name": "4.3.0",
    "default": false,
    "version": "4.3.0",
    "aliases": [],
    "path": "C:\\Program Files\\R\\R-4.3.0",
    "binary": "C:\\Program Files\\R\\R-4.3.0\\bin\\R.exe"
  },
  {
    "name": "4.5.1",
    "default": true,
    "version": "4.5.1",
    "aliases": ["release"],
    "path": "C:\\Program Files\\R\\R-4.5.1",
    "binary": "C:\\Program Files\\R\\R-4.5.1\\bin\\R.exe"
  }
]`;

// Verbatim output of `rig system rtools list --json` in rig 0.7.1: trailing
// commas, and "C:\rtools43" contains what JSON reads as a "\r" escape.
const RIG_071_RTOOLS = `[
{
  "name": "35",
  "version": "3.5",
  "fullversion": "3.5.0.4",
  "path": "C:\\Rtools",
},
{
  "name": "43",
  "version": "4.3",
  "fullversion": "4.3.5976.5975",
  "path": "C:\\rtools43",
}
]`;

suite('parseRigJson', () => {
    test('parses valid JSON unchanged', () => {
        const value = parseRigJson('[{"name": "4.5.1", "binary": "C:\\\\R\\\\bin\\\\R.exe"}]');
        assert.strictEqual(value[0].binary, 'C:\\R\\bin\\R.exe');
    });

    test('repairs unescaped Windows paths from rig 0.7', () => {
        const value = parseRigJson(RIG_071_LIST);
        assert.strictEqual(value.length, 2);
        assert.strictEqual(value[1].binary, 'C:\\Program Files\\R\\R-4.5.1\\bin\\R.exe');
    });

    test('repairs trailing commas and paths that look like escapes', () => {
        const value = parseRigJson(RIG_071_RTOOLS);
        assert.strictEqual(value[1].path, 'C:\\rtools43');
        assert.strictEqual(value[0].path, 'C:\\Rtools');
    });

    test('throws on text that is not JSON at all', () => {
        assert.throws(() => parseRigJson('not json'));
    });
});

suite('parseRigVersion', () => {
    test('reads the version from rig --version', () => {
        assert.strictEqual(parseRigVersion('RIG -- The R Installation Manager 0.7.1\n'), '0.7.1');
    });

    test('returns null for unexpected output', () => {
        assert.strictEqual(parseRigVersion(''), null);
    });
});

suite('stripAnsi', () => {
    test('removes colour codes from rig errors', () => {
        const raw = '\x1b[0m\x1b[35m[ERROR] \x1b[0mR version \x1b[1m9.9.9\x1b[22m is not installed';
        assert.strictEqual(stripAnsi(raw), '[ERROR] R version 9.9.9 is not installed');
    });
});

suite('normaliseInstalled', () => {
    test('maps fields and sorts newest first', () => {
        const result = normaliseInstalled(parseRigJson(RIG_071_LIST));
        assert.deepStrictEqual(result.map(entry => entry.version), ['4.5.1', '4.3.0']);
        assert.strictEqual(result[0].isDefault, true);
        assert.deepStrictEqual(result[0].aliases, ['release']);
        assert.strictEqual(result[1].binary, 'C:\\Program Files\\R\\R-4.3.0\\bin\\R.exe');
    });

    test('falls back to the name when version is missing', () => {
        const result = normaliseInstalled([{ name: '4.2.3' }, { name: 'devel' }]);
        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].version, '4.2.3');
        assert.strictEqual(result[0].binary, null);
        assert.strictEqual(result[0].isDefault, false);
    });

    test('handles an empty list', () => {
        assert.deepStrictEqual(normaliseInstalled([]), []);
    });
});

suite('normaliseAvailable', () => {
    test('keeps symbolic names and shortens dates', () => {
        const result = normaliseAvailable([
            { name: '4.6.1', version: '4.6.1', type: 'release', date: '2026-06-24T08:00:00.000000Z' },
            { name: 'next', version: '4.6.2', type: 'rc', date: null },
            { name: 'broken', version: null, type: 'release' }
        ]);
        assert.deepStrictEqual(result, [
            { name: '4.6.1', version: '4.6.1', type: 'release', date: '2026-06-24' },
            { name: 'next', version: '4.6.2', type: 'rc', date: null }
        ]);
    });
});

suite('computeRtoolsNeeds', () => {
    const rtoolsAvailable = [
        { version: '35', first: '3.3.0', last: '3.6.3' },
        { version: '40', first: '4.0.0', last: '4.2.100' },
        { version: '43', first: '4.3.0', last: '4.3.100' },
        { version: '44', first: '4.4.0', last: '4.4.100' },
        { version: '45', first: '4.5.0', last: '100.0.0' }
    ];
    const installedR = [
        { version: '3.5.0' },
        { version: '4.3.0' },
        { version: '4.3.2' },
        { version: '4.4.1' },
        { version: '4.6.1' }
    ];

    test('maps each R version to its Rtools and flags missing ones', () => {
        const result = computeRtoolsNeeds(rtoolsAvailable, installedR, [{ name: '35' }, { name: '43' }]);
        assert.deepStrictEqual(result, [
            { rtools: '35', rVersions: ['3.5.0'], isInstalled: true },
            { rtools: '43', rVersions: ['4.3.0', '4.3.2'], isInstalled: true },
            { rtools: '44', rVersions: ['4.4.1'], isInstalled: false },
            { rtools: '45', rVersions: ['4.6.1'], isInstalled: false }
        ]);
    });

    test('returns nothing when no R is installed', () => {
        assert.deepStrictEqual(computeRtoolsNeeds(rtoolsAvailable, [], []), []);
    });
});

// Runs against the real rig on this machine; skipped where rig is missing.
suite('rig on this machine', function () {
    this.timeout(30000);
    let rigVersion;

    suiteSetup(async function () {
        rigVersion = await getRigVersion();
        if (!rigVersion) this.skip();
    });

    test('lists installed versions with existing binaries', async () => {
        const installed = await listInstalled();
        assert.ok(installed.length > 0, 'expected at least one R version');
        for (const entry of installed) {
            assert.match(entry.version, /^\d+\.\d+(\.\d+)?$/);
            assert.ok(entry.binary, `no binary for ${entry.version}`);
            assert.ok(!/[\u0000-\u001f]/.test(entry.binary), `corrupted path ${entry.binary}`);
        }
    });
});
