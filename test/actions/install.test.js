var _ = require('lodash');
var chai = require('chai');
var assert = require('chai').assert;
var object = require('mout').object;
var path = require('path');
var fs = require('fs-extra');
var util = require('util');
var npd = require('../../lib/npd');
var h = require('../helpers');
var logger = require('../../lib/logs').logger;
var actions = require('../../lib/actions');

describe('action/install', function () {

    var where, pkg;

    beforeEach(function () {
        where = new h.TempDir();

        pkg = new h.TempDir({
            'package.json': {
                name: 'package'
            }
        }).prepare();

        npd.load();
    });


    it.only('should throw error to install nothing and module.json dose not exist', function () {
        where.prepare();
        return actions.install(where.path, []).catch(function (err) {
            assert.equal(err.code, 'ENOMODULEJSON');
        })
    });

    it('should install modules specified', function () {
        where.prepare();
        return actions.install(where.path, [pkg.path]);
    });

    it('should install modules specified by `extensions` in module.json', function () {
        where.prepare({
            'module.json': {
                'extensions': {
                    'package': pkg.path
                }
            }
        });
        return actions.install(where.path, []);
    });

    it('should work with extensions', function () {
        var submod = new h.TempDir({
            'package.json': {
                name: 'submod'
            }
        }).prepare();

        var mod1 = new h.TempDir({
            'package.json': {
                name: 'mod1'
            }
        }).prepare();

        var mod2 = new h.TempDir({
            'module.json': {
                'extensions': {
                    'submod': submod.path
                }
            },
            'package.json': {
                name: 'mod2'
            }
        }).prepare();

        var app = new h.TempDir({
            'module.json': {
                'extensions': {
                    'mod1': mod1.path,
                    'mod2': mod2.path
                }
            },
            'package.json': {
                name: 'app'
            }
        }).prepare();

        return actions.install(app.path, []);
    });

});
