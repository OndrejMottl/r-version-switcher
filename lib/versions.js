/**
 * Pure helpers for R version strings. No VS Code or child process
 * dependencies, so they can be unit tested in plain Node.
 */

const VERSION_PATTERN = /^\d+(\.\d+){1,2}$/;

/**
 * Check that a string is a numeric R version such as "4.5" or "4.5.1"
 * @param {string} version
 * @returns {boolean}
 */
function isVersion(version) {
    return typeof version === 'string' && VERSION_PATTERN.test(version);
}

/**
 * Compare two numeric versions. Missing components count as 0.
 * @param {string} a
 * @param {string} b
 * @returns {number} Negative if a < b, 0 if equal, positive if a > b
 */
function compareVersions(a, b) {
    const partsA = String(a).split('.').map(Number);
    const partsB = String(b).split('.').map(Number);
    const length = Math.max(partsA.length, partsB.length);

    for (let i = 0; i < length; i++) {
        const diff = (partsA[i] || 0) - (partsB[i] || 0);
        if (diff !== 0) return diff;
    }
    return 0;
}

/**
 * Get the "major.minor" part of a version
 * @param {string} version
 * @returns {string}
 */
function minorOf(version) {
    return String(version).split('.').slice(0, 2).join('.');
}

/**
 * Extract an R version from an R executable path. Handles the CRAN
 * Windows layout (R-4.5.1), rig user mode and Linux (.../4.5.1/bin/R),
 * macOS framework paths (Versions/4.5-arm64) and rig's version links
 * (R-4.5.1, R-4.5.1.exe).
 * @param {string} rPath
 * @returns {string|null}
 */
function extractVersionFromPath(rPath) {
    if (typeof rPath !== 'string') return null;

    const segments = rPath.split(/[\\/]/).reverse();
    for (const segment of segments) {
        // rig's Windows version links end in .exe, e.g. "R-4.5.1.exe"
        const match = segment.replace(/\.exe$/i, '').match(/^(?:R-)?(\d+\.\d+(?:\.\d+)?)(?:-[\w]+)?$/i);
        if (match) return match[1];
    }
    return null;
}

/**
 * Pick the installed version that best matches a wanted version: the exact
 * version if installed, otherwise the newest with the same major.minor
 * (the rule rig itself uses for renv.lock files).
 * @param {Array<{version: string}>} installed
 * @param {string} wanted
 * @returns {{match: object|null, exact: boolean}}
 */
function findBestMatch(installed, wanted) {
    const exact = installed.find(item => item.version === wanted);
    if (exact) return { match: exact, exact: true };

    const sameMinor = installed
        .filter(item => minorOf(item.version) === minorOf(wanted))
        .sort((a, b) => compareVersions(b.version, a.version));

    return { match: sameMinor[0] || null, exact: false };
}

module.exports = {
    isVersion,
    compareVersions,
    minorOf,
    extractVersionFromPath,
    findBestMatch
};
