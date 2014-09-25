var fs = require('fs-extra');
var path = require('path');
var noapconf = require('../../../lib/noapconf');
var Logger = require('../../../lib/logger');
var Resolver = require('../../../lib/resolvers/Resolver');

var resolver = new Resolver({ source: 'foo' }, noapconf().load(), new Logger());
resolver._createTempDir()
    .then(function (dir) {
        // Need to write something to prevent tmp to automatically
        // remove the temp dir (it removes if empty)
        fs.writeFileSync(path.join(dir, 'some_file'), 'foo');

        // Force an error
        throw new Error('Some error');
    })
    .done();


