#!/usr/bin/env node
'use strict';
var resolvePath = require('path').resolve;
var assign = require('lodash/object/assign');
var pick = require('lodash/object/pick');
var isUndefined = require('lodash/lang/isUndefined');
var fs = require('fs-extra');
var program = require('commander');
var AppBuilder = require('../lib/AppBuilder');

var config, builder;

program.version(require('../package.json').version)
    .option('-c, --config [file]', 'The location of a JSON configuration file.')
    .option('-e, --entry [file]', 'The location of an entry file to build.')
    .option('-o, --output [file]', 'The location to write a file.')
    .option('-bd, --base-dir [dir]', 'A base directory for resolving relative paths.')
    .option('-bu, --base-url [url]', 'A URL to be the <base> of the app.')
    .option('-d, --debug', 'Build in debug mode.')
    .parse(process.argv);

config = pick(assign(program.config ? fs.readJSONSync(resolvePath(program.config)) : {}, {
    baseDir: program.baseDir && resolvePath(program.baseDir),
    baseURL: program.baseUrl,

    debug: program.debug
}), function(value) {
    return !isUndefined(value);
});
builder = new AppBuilder(config);

builder.build(program.entry ? resolvePath(program.entry) : process.stdin)
    .pipe(program.output ? fs.createWriteStream(resolvePath(program.output)) : process.stdout);
