var fs = require('fs-extra');
var path = require('path');

module.exports = findPrefix();

function findPrefix() {
    var prefix;
    if (process.env.PREFIX) {
        prefix = process.env.PREFIX;
    } else {
        // /usr/local/bin/node --> bin=/usr/local
        prefix = path.dirname(path.dirname(process.execPath));

        // TODO make a better way to solve Chris Lea’s Repo node installation on ubuntu
        // or provide config set prefix to custom value
        if (prefix === '/usr') {
            prefix = '/usr/local';
            fs.mkdirpSync(prefix);
        }

        // dest dir only is respected on Unix
        if (process.env.DESTDIR) {
            prefix = path.join(process.env.DESTDIR, prefix);
        }
    }
    return prefix;
}

