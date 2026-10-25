const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { parseRenvLock, readRenvVersion } = require('../../lib/renv');

const LOCK = JSON.stringify({
    R: {
        Version: '4.4.1',
        Repositories: [{ Name: 'CRAN', URL: 'https://cloud.r-project.org' }]
    },
    Packages: {}
});

suite('parseRenvLock', () => {
    test('reads R.Version', () => {
        assert.strictEqual(parseRenvLock(LOCK), '4.4.1');
    });

    test('returns null for invalid JSON, a missing or malformed version', () => {
        assert.strictEqual(parseRenvLock('{ not json'), null);
        assert.strictEqual(parseRenvLock('{}'), null);
        assert.strictEqual(parseRenvLock('{"R": {}}'), null);
        assert.strictEqual(parseRenvLock('{"R": {"Version": "devel"}}'), null);
        assert.strictEqual(parseRenvLock(''), null);
    });
});

suite('readRenvVersion', () => {
    let dir;

    setup(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rvs-renv-'));
    });

    teardown(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    test('reads renv.lock from a folder', async () => {
        fs.writeFileSync(path.join(dir, 'renv.lock'), LOCK);
        const result = await readRenvVersion(dir);
        assert.deepStrictEqual(result, {
            version: '4.4.1',
            lockPath: path.join(dir, 'renv.lock')
        });
    });

    test('returns null without renv.lock', async () => {
        assert.strictEqual(await readRenvVersion(dir), null);
    });
});
