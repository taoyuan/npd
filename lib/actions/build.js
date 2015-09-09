var _ = require('lodash');
var path = require('path');

var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs-extra'));

var logger = require('../logs').logger;
var npd = require('../npd');
var links = require('../utils/links');
var copy = require('../utils/copy');
var lifecycle = require('../lifecycle');
var npm = require('../npm');

var mdu = require('../mdu');

module.exports = build;

function build(targets, global, didPre) {
    var builder = _build(global, didPre);

    return Promise.each(targets, function (target) {
            return builder(target);
        });
    //(args.map(function (arg) { return function (cb) {
    //    builder(arg, cb)
    //}}), cb)
}

function _build(global, didPre) {
    return function (folder) {
        folder = path.resolve(folder);
        return analyse(folder).spread(function (modmeta, pkgmeta) {
            logger.verbose('build', pkgmeta.name, pkgmeta);
            return Promise.resolve()
                .then(function () {
                    if (!didPre) return lifecycle.preinstall(modmeta, folder);
                })
                .then(function () {
                    if (npd.config['skip-npm']) return;

                    if (fs.existsSync(path.resolve(folder, 'node_modules'))) {
                        return;
                    }
                    if (lifecycle.has(modmeta, 'install')) {
                        return lifecycle.install(modmeta, folder);
                    }

                    logger.info('npm', 'install', pkgmeta);
                    return npm.install(folder, false);
                })
                .then(function () {
                    return linkStuff(pkgmeta, folder, global);
                })
                .then(function () {
                    return lifecycle.postinstall(modmeta, folder);
                });
        });
    };
}

function analyse(folder) {
    return Promise.all([
        mdu.readModuleJson(folder),
        mdu.readJson(folder, 'package.json')
    ]);
}

function linkStuff(pkg, folder, global) {
    // allow to opt out of linking binaries.
    if (npd.config["bin-links"] === false) return;

    // if it's global, and folder is in {prefix}/node_modules,
    // then bins are in {prefix}/bin
    // otherwise, then bins are in folder/../.bin
    var parent = pkg.name[0] === "@" ? path.dirname(path.dirname(folder)) : path.dirname(folder);
    var gm = global && npd.config.globalDir;
    var gtop = parent === gm;

    logger.verbose("link-stuff", pkg._id || pkg.name, pkg);

    return Promise.each([linkBins], function (fn) {
        logger.verbose(fn.name, pkg._id || pkg.name, pkg);
        return fn(pkg, folder, parent, gtop);
    });
}

function linkBins(pkg, folder, parent, gtop) {
    if (!pkg.bin) return Promise.resolve();

    var binRoot = gtop ? npd.config.globalBin : path.resolve(parent, ".bin");
    logger.verbose("link-bins", '%j', [pkg.bin, binRoot, gtop], pkg);

    var bin = typeof pkg.bin === 'string' ? _.object([pkg.name], [pkg.bin]) : pkg.bin;

    return Promise.each(Object.keys(bin), function (name) {
        var file = bin[name];
        var dst = path.resolve(binRoot, name);
        return linkBin(path.resolve(folder, file), dst)
            .then(function () {
                npd.chown(dst);
            })
            .then(function () {
                var src = path.resolve(folder, file);
                return fs.chmodAsync(src, npd.modes.exec)
                    .then(function () {
                        var dest = path.resolve(binRoot, name);
                        var out = npd.config.parseable ? dest + "::" + src + ":BINFILE" : dest + " -> " + src;
                        console.log(out);
                    }).catch(function (er) {
                        if (er.code === "ENOENT" && npd.config["ignore-scripts"]) {
                            return null;
                        }
                        throw er;
                    });
            });
    });
}

function linkBin(from, to) {
    if (process.platform !== "win32") {
        return links.linkIfExists(from, to);
    } else {
//        return cmdShimIfExists(from, to);
    }
}
