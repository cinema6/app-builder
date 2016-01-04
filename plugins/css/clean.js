'use strict';

var CleanCSS = require('clean-css');
var clone = require('lodash/lang/cloneDeep');
var assign = require('lodash/object/assign');
var dirname = require('path').dirname;
var through = require('through2');
var pump = require('pump');

function cleanCSSPlugin(path, file, config, done) {
    var options = assign(clone(config.cleanCSS || {}), {
        relativeTo: dirname(path)
    });
    var cleaner = new CleanCSS(options);
    var code = new Buffer('');

    if (config.debug) { return file; }

    return pump(file, through(function concat(chunk, encoding, next) {
        code = Buffer.concat([code, chunk]);
        next();
    }, function minify(done) {
        var stream = this;

        cleaner.minify(code.toString(), function finish(error, minified) {
            if (error) { return stream.emit('error', error); }

            stream.push(minified.styles);
            done();
        });
    }), done);
}

module.exports = cleanCSSPlugin;
