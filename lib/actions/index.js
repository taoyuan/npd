require('bluebird').longStackTraces(); // comment this in production

module.exports = {
    install: require('./install'),
    uninstall: require('./uninstall'),
    update: require('./update'),
    build: require('./build'),
    unbuild: require('./unbuild')
};
