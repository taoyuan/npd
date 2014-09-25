"use strict";

process.env.noap_root = '/tmp';
process.env.noap_repo = '/tmp';

cli(['install', 'taoyuan/noap-example'], function () {
    console.log('done');
});