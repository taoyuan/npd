var _ = require('lodash');
var path = require('path');
var fs = require('fs-extra');
var when = require('when');
var nfn = require('when/node');
var npd = require('../npd');
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
    var c = npd.config;
    var lifecycle = new Lifecycle(c, logger);
    var dissector = new Dissector(c, logger);

    // If nothing to install, skip the code bellow
    if (_.isEmpty(endpoints)) {
        return when.resolve({});
    }

    var dir = path.join(c.dir);
    var promise = fs.existsSync(dir) ?
        when.resolve() : nfn.call(fs.mkdirp, dir).then(function () { npd.chown(dir); });

    return promise
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
                var pkgmeta = endpoint.pkgMeta;
                var npdmeta = endpoint.npdMeta;
                var release = endpoint.resolvedMeta._release;
                var label = name + (release ? '#' + release : '');
                var promise = when.resolve()
                    .tap(function () {
                        logger.info('build', label, dissector.toData(endpoint));
                    })
                    .then(function () {
                        return lifecycle.preinstall(npdmeta, dst);
                    })

                    .then(function () {
                        if (fs.existsSync(path.resolve(dir, name, 'node_modules'))) {
                            return when.resolve();
                        }
                        if (lifecycle.has(npdmeta, 'install')) {
                            logger.info('custom-install', label, dissector.toData(endpoint));
                            return lifecycle.install(npdmeta, dst);
                        }
                        logger.info('npm-install', label, dissector.toData(endpoint));
                        return npm.install(dst);
                    })
                    .then(function () {
                        if (c.noBinLinks) return when.resolve();
                        logger.info('link-bins', label, dissector.toData(endpoint));
                        return linkBins(pkgmeta, endpoint.canonicalDir);
                    })
                    .then(function () {
                        return lifecycle.postinstall(npdmeta, dst);
                    })
                    .then(function () {
                        npd.chown(dst);
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

        var binRoot = c.bin;//top ? c.globalBin : path.resolve(parent, ".bin");
//    log.verbose("link bins", [pkg.bin, binRoot, top])

        var promises = [];
        var bin = typeof pkg.bin === 'string' ? _.object([pkg.name], [pkg.bin]) : pkg.bin;
        _.forEach(bin, function (file, name) {
            var dst = path.resolve(binRoot, name);
            promises.push(linkBin(path.resolve(folder, file), dst)
                .then(function () {
                    npd.chown(dst);
                })
                .then(function () {
                    var src = path.resolve(folder, file);
                    return nfn.call(fs.chmod, src, npd.modes.exec).then(function () {
                        var dest = path.resolve(binRoot, name);
                        var out = c.parseable ? dest + "::" + src + ":BINFILE" : dest + " -> " + src;
                        console.log(out);
                    }).catch(function (er) {
                        if (er.code === "ENOENT" && c["ignore-scripts"]) {
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

