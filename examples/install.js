"use strict";

process.env.npd_root = '/tmp';
process.env.npd_repo = '/tmp';

cli(['install', 'taoyuan/npd-example'], function () {
    console.log('done');
});