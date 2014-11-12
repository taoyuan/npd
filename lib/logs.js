var _ = require('lodash');
var wide = require('wide');
var pkg = require('../package');

var Standard = require('./transports/standard').Standard;

function createLogger(options) {
    options = _.assign({
        level: 'error',
        transports: [
            new Standard()
        ]
    }, options);

    var logger = new wide.Logger(options);

    logger.on('logged', function (rec) {
        if (rec.level === 'error' && logger.exitOnError) {
            process.exit(1);
        }
    });

    logger.cli('npd', { appversion: pkg.version, timestamp: 'short' });

    return logger;
}


module.exports.logger = createLogger({ level: 'info' });
module.exports.createLogger = createLogger;
