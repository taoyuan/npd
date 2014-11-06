var assert = require('chai').assert;
var logs = require('../lib/logs');

describe('logger', function () {

    it('should print error', function () {
        var log = logs.createLogger({exitOnError: false});
        log.error(new Error('this is test error'));
    });
});
