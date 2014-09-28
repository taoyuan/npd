"use strict";

var path = require('path');
var paths = require('./paths');

module.exports = function () {
    var prefix;
    if (process.env.PREFIX) {
        prefix = process.env.PREFIX;
    } else {
        // /usr/local/bin/node --> bin=/usr/local
        prefix = path.dirname(path.dirname(process.execPath));

        // dest dir only is respected on Unix
        if (process.env.DESTDIR) {
            prefix = path.join(process.env.DESTDIR, prefix);
        }
    }

    return {
        cwd: process.cwd(),
        root: '/',
        repo: '/opt',
        tmp: paths.tmp,
        prefix: prefix,
        storage: {
            packages: path.join(paths.cache, 'packages'),
            links: path.join(paths.data, 'links'),
            completion: path.join(paths.data, 'completion'),
            registry: path.join(paths.cache, 'registry'),
            empty: path.join(paths.data, 'empty')  // Empty dir, used in GIT_TEMPLATE_DIR among others
        }
    };
};