/**
 * Read the R version a project's renv.lock file requires
 */

const fs = require('fs');
const path = require('path');

const { isVersion } = require('./versions');

/**
 * Extract the R version from the text of an renv.lock file
 * @param {string} text
 * @returns {string|null} The version, or null if the file has none
 */
function parseRenvLock(text) {
    let lock;
    try {
        lock = JSON.parse(text);
    } catch {
        return null;
    }
    const version = lock && lock.R && lock.R.Version;
    return isVersion(version) ? version : null;
}

/**
 * Read the R version from renv.lock in a folder
 * @param {string} folderPath
 * @returns {Promise<{version: string, lockPath: string}|null>}
 */
async function readRenvVersion(folderPath) {
    const lockPath = path.join(folderPath, 'renv.lock');
    let text;
    try {
        text = await fs.promises.readFile(lockPath, 'utf8');
    } catch {
        return null;
    }
    const version = parseRenvLock(text);
    return version ? { version, lockPath } : null;
}

module.exports = {
    parseRenvLock,
    readRenvVersion
};
