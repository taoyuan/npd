"use strict";

module.exports =  {
    Fs: require('./fs-resolver'),
    Url: require('./url-resolver'),
    GitFs: require('./git-fs-resolver'),
    GitRemote: require('./git-remote-resolver'),
    GitHub: require('./github-resolver'),
    Svn: require('./svn-resolver')
};