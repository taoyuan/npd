"use strict";

var path = require('path');
var fs = require('fs-extra');
var osenv = require('osenv');
var sh = require('../utils/sh');
var paths = require('./paths');

module.exports = function () {
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

    return {
        "uid": osenv.user(),
        "hosts": {
            github: 'git://github.com/{{owner}}/{{package}}.git',
            gh: "@github",
            bitbucket: 'https://bitbucket.org/{{owner}}/{{package}}.git',
            bb: "@bitbucket"
        },
        "tmp": paths.tmp,
        "prefix": prefix,
        "apps": 'apps',
        "color": true,
        "umask": process.umask ? process.umask() : parseInt("022", 8),
        "storage": {
            "packages": path.join(paths.cache, 'packages'),
            "links": path.join(paths.data, 'links'),
            "completion": path.join(paths.data, 'completion'),
            "registry": path.join(paths.cache, 'registry'),
            "empty": path.join(paths.data, 'empty')  // Empty dir, used in GIT_TEMPLATE_DIR among others
        }
    };
};
