'use strict';

var dirname = require('path').dirname;
var fs = require('fs-extra');
var spawn = require('child_process').spawn;
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var pump = require('pump');
var defaults = require('lodash/object/defaultsDeep');
var clone = require('lodash/lang/cloneDeep');
var through = require('through2');

var plugins = {
    browserify: require.resolve('../plugins/js/browserify'),
    uglify: require.resolve('../plugins/js/uglify'),
    cleanCSS: require.resolve('../plugins/css/clean')
};

function AppBuilder(config) {
    this.config = clone(config || {});

    this.plugins = defaults(clone(this.config.plugins || {}), {
        js: [plugins.browserify, plugins.uglify],
        css: [plugins.cleanCSS]
    });

    EventEmitter.call(this);
}
inherits(AppBuilder, EventEmitter);

AppBuilder.prototype.build = function build(/*entry*/) {
    var self = this;
    var isPath = (typeof arguments[0] === 'string');
    var entry = isPath ? fs.createReadStream(arguments[0]) : arguments[0];
    var worker, errorMessage;
    var alive = true;

    function handleError(error) {
        if (error) { self.emit('error', error); }
    }

    if (isPath) {
        this.config.baseDir = dirname(arguments[0]);
    }

    worker = spawn(process.execPath, [
        require.resolve('./workers/build.js'),
        JSON.stringify(this.config),
        JSON.stringify(this.plugins)
    ]);
    worker.once('exit', function handleExit(code) {
        alive = false;
        if (code > 0) { self.emit('error', new Error(errorMessage)); }
    });
    worker.stderr.on('data', function emitError(data) {
        errorMessage = data.toString();
    });

    pump(entry, worker.stdin, handleError);

    return pump(worker.stdout, through(function passthrough(buffer, encoding, done) {
        this.push(buffer); done();
    }, function waitForExit(done) {
        if (alive) { worker.once('exit', done); } else { done(); }
    }), handleError);
};

module.exports = AppBuilder;
