"use strict";

var t = require('chai').assert;
var path = require('path');
var fs = require('fs-extra');
var Logger = require('../lib/logger');
var Manager = require('../lib/manager');
var npdconf = require('../lib/npdconf');

describe('Manager', function () {
    var manager;

    var packagesCacheDir =
        path.join(__dirname, './fixtures/temp-resolve-cache');

    var registryCacheDir =
        path.join(__dirname, './fixtures/temp-registry-cache');

    after(function () {
        fs.removeSync(registryCacheDir);
        fs.removeSync(packagesCacheDir);
    });

    beforeEach(function (next) {
        var logger = new Logger();

        var config = npdconf({
            storage: {
                packages: packagesCacheDir,
                registry: registryCacheDir
            }
        });

        manager = new Manager(config, logger);

        next();
    });


    describe('_areCompatible', function () {
        describe('resolved is being fetched', function() {

            it('accepts endpoints with same targets', function () {
                t.isTrue(manager._areCompatible(
                    { name: 'foo', target: 'xxx' },
                    { name: 'bar', target: 'xxx' }
                ));
            });

            it('rejects endpoints with different targets', function () {
                t.isFalse(manager._areCompatible(
                    { name: 'foo', target: 'xxx' },
                    { name: 'bar', target: 'yyy' }
                ));
            });

            it('accepts with version and matching range', function () {
                t.isTrue(manager._areCompatible(
                    { name: 'foo', target: '0.1.2' },
                    { name: 'bar', target: '~0.1.0' }
                ));
            });

            it('rejects with version and non-matching range', function () {
                t.isFalse(manager._areCompatible(
                    { name: 'foo', target: '0.1.2' },
                    { name: 'bar', target: '~0.1.3' }
                ));
            });

            it('accepts with matching range and version', function () {
                t.isTrue(manager._areCompatible(
                    { name: 'foo', target: '~0.1.0' },
                    { name: 'bar', target: '0.1.2' }
                ));
            });

            it('accepts with non-matching range and version', function () {
                t.isFalse(manager._areCompatible(
                    { name: 'foo', target: '~0.1.3' },
                    { name: 'bar', target: '0.1.2' }
                ));
            });

            it('accepts with matching ranges', function () {
                t.isTrue(manager._areCompatible(
                    { name: 'foo', target: '~0.1.0' },
                    { name: 'bar', target: '~0.1.3' }
                ));
            });

            it('rejects with non-matching ranges', function () {
                t.isFalse(manager._areCompatible(
                    { name: 'foo', target: '~0.1.0' },
                    { name: 'bar', target: '~0.2.3' }
                ));
            });

            it('rejects with non-matching ranges', function () {
                t.isFalse(manager._areCompatible(
                    { name: 'foo', target: '~0.1.0' },
                    { name: 'bar', target: 'xxx' }
                ));
            });
        });

        describe('resolved is already fetched', function () {
            var resolved = {
                name: 'foo',
                target: '~1.2.1',
                pkgMeta: {
                    version: '1.2.3'
                }
            };

            it('accepts if the same version as resolved', function () {
                t.isTrue(manager._areCompatible(
                    { name: 'foo', target: '1.2.3' },
                    resolved
                ));
            });

            it('rejects if different version than resolved', function () {
                t.isFalse(manager._areCompatible(
                    { name: 'foo', target: '1.2.4' },
                    resolved
                ));
            });

            it('accepts if range matches resolved version', function () {
                t.isTrue(manager._areCompatible(
                    { name: 'foo', target: '~1.2.1' },
                    resolved
                ));
            });

            it('rejects if range does not match', function () {
                t.isFalse(manager._areCompatible(
                    { name: 'foo', target: '~1.2.4' },
                    resolved
                ));
            });
        });
    });

    describe('_getCap', function () {
        it('finds highest bound', function () {
            var highest = manager._getCap(
                [['2.1.1-0', '<2.2.0-0'], '<3.2.0'],
                'highest'
            );

            t.deepEqual(highest, {
                version: '3.2.0',
                comparator: '<'
            });
        });

        it('finds lowest bound', function () {
            var highest = manager._getCap(
                [['2.1.1-0', '<2.2.0-0'], '<3.2.0'],
                'lowest'
            );

            t.deepEqual(highest, {
                version: '2.1.1-0',
                comparator: ''
            });
        });

        it('defaults to highest bound', function () {
            var highest = manager._getCap(
                ['1.0.0', '2.0.0']
            );

            t.deepEqual(highest, {
                version: '2.0.0',
                comparator: ''
            });
        });


        it('ignores non-semver elements', function () {
            var highest = manager._getCap(
                ['0.9', '>1.0.1', ['<1.0.0', 'lol']]
            );

            t.deepEqual(highest, {
                version: '1.0.1',
                comparator: '>'
            });
        });

        it('returns empty object if cap is not found', function () {
            var highest = manager._getCap(
                ['0.9'] // Not a semver
            );

            t.deepEqual(highest, {});
        });
    });

    describe('_uniquify', function () {

        it('leaves last unique element', function () {
            var unique = manager._uniquify([
                { name: 'foo', id: 1 },
                { name: 'foo', id: 2 }
            ]);
            t.deepEqual(unique, [
                { name: 'foo', id: 2 }
            ]);
        });

        it('compares by name first', function () {
            var unique = manager._uniquify([
                { name: 'foo', source: 'google.com' },
                { name: 'foo', source: 'facebook.com' }
            ]);

            t.deepEqual(unique, [
                { name: 'foo', source: 'facebook.com' }
            ]);
        });

        it('compares by source if name is not available', function () {
            var unique = manager._uniquify([
                { source: 'facebook.com' },
                { source: 'facebook.com' }
            ]);

            t.deepEqual(unique, [
                { source: 'facebook.com' }
            ]);
        });

        it('leaves different targets intact', function() {
            var unique = manager._uniquify([
                { source: 'facebook.com', target: 'a1b2c3' },
                { source: 'facebook.com', target: 'ffffff' }
            ]);

            t.deepEqual(unique, [
                { source: 'facebook.com', target: 'a1b2c3' },
                { source: 'facebook.com', target: 'ffffff' }
            ]);
        });

        it('removes if same targets', function() {
            var unique = manager._uniquify([
                { source: 'facebook.com', target: 'ffffff' },
                { source: 'facebook.com', target: 'ffffff' }
            ]);

            t.deepEqual(unique, [
                { source: 'facebook.com', target: 'ffffff' }
            ]);
        });

        it('ignores other fields', function() {
            var unique = manager._uniquify([
                { source: 'facebook.com', foo: 12 },
                { source: 'facebook.com', bar: 13 }
            ]);

            t.deepEqual(unique, [
                { source: 'facebook.com', bar: 13 }
            ]);
        });
    });

});
