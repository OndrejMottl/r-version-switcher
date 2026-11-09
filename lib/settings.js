/**
 * Pure helpers for the vscode-R settings this extension writes. No VS Code
 * dependency, so they can be unit tested in plain Node.
 *
 * vscode-R 3.x reads the R executable from `r.executablePath` and passes
 * `r.consoleArgs` to the console (radian). The older names `r.rpath.*` and
 * `r.rterm.option` are deprecated.
 */

const path = require('path');

const EXECUTABLE_SETTING = 'executablePath';
const CONSOLE_ARGS_SETTING = 'consoleArgs';
const LEGACY_CONSOLE_ARGS_SETTING = 'rterm.option';
const R_BINARY_FLAG = '--r-binary=';

/**
 * Name of the deprecated platform-specific R path setting
 * @param {string} platform process.platform
 * @returns {string}
 */
function legacyRPathSetting(platform) {
    if (platform === 'darwin') return 'rpath.mac';
    if (platform === 'linux') return 'rpath.linux';
    return 'rpath.windows';
}

/**
 * Name of the version link that `rig system make-links` creates for an
 * installed R, e.g. "R-4.5.1". On Windows it includes ".exe": vscode-R only
 * adds ".exe" to names without an extension, and "R-4.5.1" looks like it
 * has one (".1").
 * @param {string} rigName Name from `rig list`, e.g. "4.5.1" or "4.5-arm64"
 * @param {string} [platform] process.platform
 * @returns {string}
 */
function rigLinkName(rigName, platform = process.platform) {
    return platform === 'win32' ? `R-${rigName}.exe` : `R-${rigName}`;
}

/**
 * Find an executable on PATH, the way a shell would
 * @param {string} name e.g. "rig" or "R-4.5.1"
 * @param {object} options
 * @param {string} [options.pathEnv] Value of PATH
 * @param {string} [options.pathExt] Value of PATHEXT (Windows)
 * @param {string} [options.platform] process.platform
 * @param {(candidate: string) => boolean} options.isFile
 * @returns {string|null} Absolute path, or null if not found
 */
function findExecutable(name, { pathEnv = '', pathExt = '', platform = process.platform, isFile }) {
    const isWindows = platform === 'win32';
    const pathApi = isWindows ? path.win32 : path.posix;
    const dirs = pathEnv.split(isWindows ? ';' : ':').filter(Boolean);
    // On Windows, try the name as given only if it already ends in an
    // executable extension: "R-4.5.1" ends in ".1", which is not one.
    const executableExtensions = (pathExt || '.EXE;.CMD;.BAT')
        .split(';').filter(Boolean).map(ext => ext.toLowerCase());
    const hasExecutableExtension = executableExtensions.includes(pathApi.extname(name).toLowerCase());
    const extensions = isWindows && !hasExecutableExtension ? executableExtensions : [''];

    for (const dir of dirs) {
        for (const extension of extensions) {
            const candidate = pathApi.join(dir, `${name}${extension}`);
            if (isFile(candidate)) return candidate;
        }
    }
    return null;
}

/**
 * Value to write to `r.executablePath` (and `--r-binary`) for an installed
 * R: rig's version link when it is on PATH, since it contains no install
 * path and works on every machine with that version; the full path
 * otherwise.
 * @param {{name: string, binary: string}} entry Installed R from rig
 * @param {(name: string) => string|null} findOnPath
 * @param {string} [platform] process.platform
 * @returns {string}
 */
function executableSettingFor(entry, findOnPath, platform = process.platform) {
    const link = rigLinkName(entry.name, platform);
    return findOnPath(link) ? link : entry.binary;
}

/**
 * Check whether a configured R executable refers to an installed R, either
 * by its full path or by its rig link name
 * @param {string|undefined} configured Value of the setting
 * @param {{name: string, binary: string}} entry
 * @param {string} [platform]
 * @returns {boolean}
 */
function settingMatchesEntry(configured, entry, platform = process.platform) {
    if (!configured) return false;
    const normalise = value => {
        let text = String(value).trim().replace(/^(["'])(.*)\1$/, '$2');
        if (platform === 'win32') text = text.toLowerCase().replace(/\.exe$/, '');
        return text;
    };
    const target = normalise(configured);
    return target === normalise(entry.binary) || target === normalise(rigLinkName(entry.name, platform));
}

/**
 * Console arguments with `--r-binary` set to the given R. Other arguments
 * are kept in order; an existing `--r-binary` is replaced in place.
 * @param {unknown} args Current arguments
 * @param {string} rBinary
 * @returns {string[]}
 */
function withRBinary(args, rBinary) {
    const flag = `${R_BINARY_FLAG}${rBinary}`;
    const isFlag = arg => typeof arg === 'string' && arg.startsWith(R_BINARY_FLAG);
    const current = Array.isArray(args) ? args : [];
    const first = current.findIndex(isFlag);
    if (first < 0) return [...current, flag];
    return current
        .map((arg, index) => (index === first ? flag : arg))
        .filter((arg, index) => index === first || !isFlag(arg));
}

module.exports = {
    EXECUTABLE_SETTING,
    CONSOLE_ARGS_SETTING,
    LEGACY_CONSOLE_ARGS_SETTING,
    legacyRPathSetting,
    rigLinkName,
    findExecutable,
    executableSettingFor,
    settingMatchesEntry,
    withRBinary
};
