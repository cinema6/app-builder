'use strict';

var dirname = require('path').dirname;
var fs = require('fs-extra');
var spawn = require('child_process').spawn;

var plugins = {
    browserify: require.resolve('../plugins/js/browserify'),
    uglify: require.resolve('../plugins/js/uglify'),
    cleanCSS: require.resolve('../plugins/css/clean')
};

function AppBuilder(config) {
    this.config = config || {};

    this.plugins = {
        js: [plugins.browserify, plugins.uglify],
        css: [plugins.cleanCSS]
    };
}

AppBuilder.prototype.build = function build(/*entry*/) {
    var isPath = (typeof arguments[0] === 'string');
    var entry = isPath ? fs.createReadStream(arguments[0]) : arguments[0];
    var worker;

    if (isPath) {
        this.config.baseDir = dirname(arguments[0]);
    }

    worker = spawn(process.execPath, [
        require.resolve('./workers/build.js'),
        JSON.stringify(this.config),
        JSON.stringify(this.plugins)
    ]);

    entry.pipe(worker.stdin);

    return worker.stdout;
};

module.exports = AppBuilder;
