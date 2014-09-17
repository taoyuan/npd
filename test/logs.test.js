'use strict';

var logs = require('../lib/logs');

function outlog(log) {
    log.log('this is test message');
    log.log('this is test message');
    log.warn('this is test message');
    log.error('this is test message');
}

describe('logs', function () {

    it('logger', function () {
        var log = logs.logger;
        log.log('', 'this is test message');
        log.log('', 'this is test message');
        log.warn('hello', 'this is test message');
        log.error('hello', 'this is test message');
    });

    it('default', function () {
        outlog(logs.default);
    });
});
