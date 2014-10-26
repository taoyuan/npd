var _ = require('lodash');
var path = require('path');
var fs = require('fs-extra');
var when = require('when');
var nfn = require('when/node');
var npd = require('../npd');
var npdu = require('../npdu');
var links = require('../utils/links');
var copy = require('../utils/copy');
var Dissector = require('../dissector');
var Lifecycle = require('../lifecycle');
var npm = require('../npm');
var utils = require('../utils');

var unbuild = require('./unbuild');

module.exports = build;

/**
 *
 * @param {Object} endpoints
 * @param {Logger} logger
 * @returns {When.Promise<U>|Promise|*}
 */
function build(endpoints, logger) {
    var that = this;
    var lifecycle = new Lifecycle(npd.config, logger);
    var dissector = new Dissector(npd.config, logger);

    // If nothing to install, skip the code bellow
    if (_.isEmpty(endpoints)) {
        return when.resolve({});
    }

    var dir = path.join(npd.config.dir);
    return nfn.call(fs.mkdirp, dir)
        .then(function () {
            npdu.chownSync(dir);
        })
        .then(function () {
            var promises = [];

            _.forEach(endpoints, function (endpoint, name) {
                var promise;
                var dst;
                var release = endpoint.resolvedMeta._release;

                logger.action('install', name + (release ? '#' + release : ''), dissector.toData(endpoint));

                dst = path.join(dir, name);

                // Remove existent and copy canonical dir
                promise = unbuild(endpoint, logger)
                    .then(copy.copyDir.bind(copy, endpoint.canonicalDir, dst))
                    .then(function () {
                        var metaFile = path.join(dst, '.package.json');

                        endpoint.canonicalDir = dst;
                        endpoint.pkgMeta = endpoint.resolvedMeta;
                        endpoint.npdMeta = utils.readNpdJson(dst);

                        return utils.readJson(metaFile)
                            .then(function (json) {
                                json._target = endpoint.target;
                                json._originalSource = endpoint.source;
                                if (endpoint.newly) {
                                    json._direct = true;
                                }

                                json = JSON.stringify(json, null, '  ');
                                return nfn.call(fs.writeFile, metaFile, json);
                            });
                    });

                promises.push(promise);
            });

            return when.all(promises);
        })
        .then(function () {

            var promises = [];
            _.forEach(endpoints, function (endpoint, name) {
                var dst = path.join(dir, name);
                var promise = when.resolve()
                    .then(function () {
                        return lifecycle.preinstall(endpoint.npdMeta, dst);
                    })
                    .then(function () {
                        if (fs.existsSync(path.resolve(dir, name, 'node_modules'))) {
                            return when.resolve();
                        }
                        return npm.install(path.resolve(dir, name));
                    })
                    .then(function () {
                        return linkBins(endpoint.pkgMeta, endpoint.canonicalDir);
                    })
                    .then(function () {
                        return lifecycle.postinstall(endpoint.npdMeta, dst);
                    })
                    .then(function () {
                        npdu.chownSync(dst);
                    });
                promises.push(promise);
            });
            return when.all(promises);
        })
        .then(function () {
            // Resolve with meaningful data
            return _.map(endpoints, function (endpoint) {
                return dissector.toData(endpoint);
            }, that);
        });

    function linkBins(pkg, folder) {
        if (!pkg.bin) return when.resolve();

        var c = npd.config;
        var binRoot = c.bin;//top ? c.globalBin : path.resolve(parent, ".bin");
//    log.verbose("link bins", [pkg.bin, binRoot, top])

        var promises = [];
        var bin = typeof pkg.bin === 'string' ? _.object([pkg.name], [pkg.bin]) : pkg.bin;
        _.forEach(bin, function (file, name) {
            promises.push(linkBin(path.resolve(folder, file), path.resolve(binRoot, name)).then(function () {
                var src = path.resolve(folder, file);
                return nfn.call(fs.chmod, src, npm.modes.exec).then(function () {
                    var dest = path.resolve(binRoot, name),
                        out = npm.config.get("parseable") ? dest + "::" + src + ":BINFILE" : dest + " -> " + src;
                    console.log(out);
                }).catch(function (er) {
                    if (er.code === "ENOENT" && npm.config.get("ignore-scripts")) {
                        return null;
                    }
                    throw er;
                });
            }));
        });
        return when.all(promises);
    }

    function linkBin(from, to) {
        if (process.platform !== "win32") {
            return links.linkIfExists(from, to);
        } else {
//        return cmdShimIfExists(from, to);
        }
    }
}

