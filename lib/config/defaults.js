"use strict";

var path = require('path');
var osenv = require('osenv');
var paths = require('./paths');

module.exports = function () {
    return {
        "uid": osenv.user(),
        "hosts": {
            github: 'git://github.com/{{owner}}/{{package}}.git',
            gh: "@github",
            bitbucket: 'https://bitbucket.org/{{owner}}/{{package}}.git',
            bb: "@bitbucket"
        },
        "tmp": paths.tmp,
        "silo": 'silo',
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
