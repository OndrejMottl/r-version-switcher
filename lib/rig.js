/**
 * Thin wrapper around the rig command line tool, plus the parsers for its
 * output. Nothing here depends on VS Code.
 */

const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

const { isVersion, compareVersions } = require('./versions');

// Run rig directly rather than through a shell: Windows PowerShell 5.1 is
// broken or blocked on some machines, and no shell features are needed.
const execFileAsync = promisify(execFile);

const EXEC_TIMEOUT = 30000; // 30 seconds; `rig available` hits the network

/**
 * Remove ANSI colour codes, which rig adds to its error messages
 * @param {string} text
 * @returns {string}
 */
function stripAnsi(text) {
    return String(text).replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Check whether any string in a parsed JSON value contains a control
 * character, which means a Windows path was decoded as escapes ("\r", "\b").
 * @param {*} value
 * @returns {boolean}
 */
function hasControlCharacters(value) {
    if (typeof value === 'string') return /[\u0000-\u001f]/.test(value);
    if (Array.isArray(value)) return value.some(hasControlCharacters);
    if (value && typeof value === 'object') {
        return Object.values(value).some(hasControlCharacters);
    }
    return false;
}

/**
 * Parse JSON printed by rig. rig 0.7 on Windows prints paths without
 * escaping backslashes ("C:\Program Files\R") and some commands add
 * trailing commas, so fall back to repairing the text when strict parsing
 * fails or decodes a path into control characters.
 * @param {string} text
 * @returns {*}
 */
function parseRigJson(text) {
    try {
        const parsed = JSON.parse(text);
        if (!hasControlCharacters(parsed)) return parsed;
    } catch {
        // Fall through to the repair below.
    }

    const repaired = text
        .replace(/\\/g, '\\\\')
        .replace(/,(\s*[}\]])/g, '$1');
    return JSON.parse(repaired);
}

/**
 * Extract the rig version from `rig --version` output
 * @param {string} text e.g. "RIG -- The R Installation Manager 0.7.1"
 * @returns {string|null}
 */
function parseRigVersion(text) {
    const match = String(text).match(/(\d+\.\d+\.\d+)/);
    return match ? match[1] : null;
}

/**
 * Normalise `rig list --json` entries
 * @param {Array<object>} entries
 * @returns {Array<{name: string, version: string, isDefault: boolean, aliases: string[], binary: string|null}>}
 */
function normaliseInstalled(entries) {
    return entries
        .map(entry => ({
            name: entry.name,
            version: entry.version || (isVersion(entry.name) ? entry.name : null),
            isDefault: entry.default === true,
            aliases: Array.isArray(entry.aliases) ? entry.aliases : [],
            binary: entry.binary || null
        }))
        .filter(entry => entry.version)
        .sort((a, b) => compareVersions(b.version, a.version));
}

/**
 * Normalise `rig available --json` entries
 * @param {Array<object>} entries
 * @returns {Array<{name: string, version: string, type: string, date: string|null}>}
 */
function normaliseAvailable(entries) {
    return entries
        .filter(entry => isVersion(entry.version))
        .map(entry => ({
            name: entry.name,
            version: entry.version,
            type: entry.type || 'release',
            date: entry.date ? String(entry.date).slice(0, 10) : null
        }));
}

/**
 * Find which Rtools version each installed R version needs, using the
 * ranges from `rig available --list-rtools-versions --json`
 * @param {Array<{version: string, first: string, last: string}>} rtoolsVersions
 * @param {Array<{version: string}>} installedR
 * @param {Array<{name: string}>} installedRtools
 * @returns {Array<{rtools: string, rVersions: string[], isInstalled: boolean}>}
 */
function computeRtoolsNeeds(rtoolsVersions, installedR, installedRtools) {
    const installedNames = new Set(installedRtools.map(item => String(item.name)));

    return rtoolsVersions
        .map(rtools => ({
            rtools: String(rtools.version),
            rVersions: installedR
                .map(item => item.version)
                .filter(version =>
                    compareVersions(version, rtools.first) >= 0 &&
                    compareVersions(version, rtools.last) <= 0
                ),
            isInstalled: installedNames.has(String(rtools.version))
        }))
        .filter(item => item.rVersions.length > 0);
}

/**
 * Locate the rig executable on PATH, so it can be started as a task
 * process without a shell
 * @returns {string} Absolute path, or "rig" if it is not found
 */
function resolveRigExecutable() {
    const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
    const extensions = process.platform === 'win32'
        ? (process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';')
        : [''];

    for (const dir of dirs) {
        for (const extension of extensions) {
            const candidate = path.join(dir, `rig${extension.toLowerCase()}`);
            try {
                if (fs.statSync(candidate).isFile()) return candidate;
            } catch {
                // Not in this directory.
            }
        }
    }
    return 'rig';
}

/**
 * Run rig and return its standard output. Errors carry rig's own message,
 * without colour codes.
 * @param {string[]} args
 * @returns {Promise<string>}
 */
async function runRig(args) {
    try {
        const result = await execFileAsync('rig', args, {
            timeout: EXEC_TIMEOUT,
            maxBuffer: 1024 * 1024 // 1MB buffer
        });
        return result.stdout;
    } catch (error) {
        // A timeout kills the process; it does not set error.code.
        if (error.killed) {
            throw new Error(`'rig ${args.join(' ')}' timed out`);
        }
        if (error.code === 'ENOENT') {
            throw new Error('rig is not installed or not on PATH');
        }
        const detail = stripAnsi(error.stderr || error.message).trim();
        throw new Error(`'rig ${args.join(' ')}' failed: ${detail}`);
    }
}

/**
 * @returns {Promise<string|null>} rig version, or null if rig is missing
 */
async function getRigVersion() {
    try {
        return parseRigVersion(await runRig(['--version']));
    } catch {
        return null;
    }
}

async function listInstalled() {
    return normaliseInstalled(parseRigJson(await runRig(['list', '--json'])));
}

async function listAvailable(all = false) {
    const args = ['available', '--json'];
    if (all) args.push('--all');
    return normaliseAvailable(parseRigJson(await runRig(args)));
}

async function listRtoolsAvailable() {
    return parseRigJson(
        await runRig(['available', '--list-rtools-versions', '--json'])
    );
}

async function listRtoolsInstalled() {
    // `rig system rtools` is kept in newer rig for backwards compatibility,
    // so it works across versions (newer rig also has `rig rtools`).
    return parseRigJson(await runRig(['system', 'rtools', 'list', '--json']));
}

module.exports = {
    stripAnsi,
    parseRigJson,
    parseRigVersion,
    normaliseInstalled,
    normaliseAvailable,
    computeRtoolsNeeds,
    resolveRigExecutable,
    runRig,
    getRigVersion,
    listInstalled,
    listAvailable,
    listRtoolsAvailable,
    listRtoolsInstalled
};
