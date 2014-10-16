var fs = require('fs-extra');
var path = require('path');
var Logger = require('bower-logger');
var npdconf = require('../../../lib/npdconf');
var Resolver = require('../../../lib/resolvers/resolver');

var resolver = new Resolver({ source: 'foo' }, npdconf(), new Logger());
resolver._createTempDir()
    .then(function (dir) {
        // Need to write something to prevent tmp to automatically
        // remove the temp dir (it removes if empty)
        fs.writeFileSync(path.join(dir, 'some_file'), 'foo');

        // Force an error
        throw new Error('Some error');
    })
    .done();


