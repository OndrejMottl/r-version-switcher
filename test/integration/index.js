// Mocha entry point loaded by VS Code inside the extension host
const path = require('path');
const fs = require('fs');
const Mocha = require('mocha');

function run() {
    const mocha = new Mocha({
        ui: 'tdd',
        color: true,
        timeout: 60000
    });

    fs.readdirSync(__dirname)
        .filter(file => file.endsWith('.test.js'))
        .forEach(file => mocha.addFile(path.join(__dirname, file)));

    return new Promise((resolve, reject) => {
        mocha.run(failures => {
            if (failures > 0) {
                reject(new Error(`${failures} tests failed.`));
            } else {
                resolve();
            }
        });
    });
}

module.exports = { run };
