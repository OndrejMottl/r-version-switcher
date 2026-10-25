const assert = require('assert');

const {
    isVersion,
    compareVersions,
    minorOf,
    extractVersionFromPath,
    findBestMatch
} = require('../../lib/versions');

suite('isVersion', () => {
    test('accepts major.minor and major.minor.patch', () => {
        assert.strictEqual(isVersion('4.5.1'), true);
        assert.strictEqual(isVersion('4.5'), true);
    });

    test('rejects symbolic names, partial and non-string input', () => {
        for (const value of ['devel', 'next', '4', '4.5.1.2', '', null, undefined, 4.5]) {
            assert.strictEqual(isVersion(value), false, String(value));
        }
    });
});

suite('compareVersions', () => {
    test('compares numerically, not as strings', () => {
        assert.ok(compareVersions('4.10.0', '4.9.0') > 0);
        assert.ok(compareVersions('3.6.3', '4.0.0') < 0);
        assert.strictEqual(compareVersions('4.5.1', '4.5.1'), 0);
    });

    test('treats missing components as 0', () => {
        assert.strictEqual(compareVersions('4.5', '4.5.0'), 0);
        assert.ok(compareVersions('4.2.100', '4.2') > 0);
    });
});

suite('minorOf', () => {
    test('returns major.minor', () => {
        assert.strictEqual(minorOf('4.5.1'), '4.5');
        assert.strictEqual(minorOf('4.5'), '4.5');
    });
});

suite('extractVersionFromPath', () => {
    test('reads the CRAN Windows layout', () => {
        assert.strictEqual(
            extractVersionFromPath('C:\\Program Files\\R\\R-4.5.1\\bin\\R.exe'),
            '4.5.1'
        );
    });

    test('reads rig user-mode, Linux and macOS layouts', () => {
        assert.strictEqual(
            extractVersionFromPath('C:\\Users\\me\\AppData\\Roaming\\rig\\data\\r\\4.6.1\\bin\\R.exe'),
            '4.6.1'
        );
        assert.strictEqual(extractVersionFromPath('/opt/R/4.4.1/bin/R'), '4.4.1');
        assert.strictEqual(
            extractVersionFromPath('/Library/Frameworks/R.framework/Versions/4.5-arm64/Resources/bin/R'),
            '4.5'
        );
    });

    test('returns null when there is no version', () => {
        assert.strictEqual(extractVersionFromPath('/usr/bin/R'), null);
        assert.strictEqual(extractVersionFromPath(undefined), null);
        assert.strictEqual(extractVersionFromPath(''), null);
    });
});

suite('findBestMatch', () => {
    const installed = [
        { version: '4.5.1' },
        { version: '4.4.1' },
        { version: '4.3.0' },
        { version: '4.3.2' }
    ];

    test('prefers the exact version', () => {
        const result = findBestMatch(installed, '4.3.0');
        assert.strictEqual(result.exact, true);
        assert.strictEqual(result.match.version, '4.3.0');
    });

    test('falls back to the newest patch of the same minor version', () => {
        const result = findBestMatch(installed, '4.3.3');
        assert.strictEqual(result.exact, false);
        assert.strictEqual(result.match.version, '4.3.2');
    });

    test('returns no match when the minor version is not installed', () => {
        const result = findBestMatch(installed, '4.2.3');
        assert.deepStrictEqual(result, { match: null, exact: false });
        assert.deepStrictEqual(findBestMatch([], '4.5.1'), { match: null, exact: false });
    });
});
