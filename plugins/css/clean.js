'use strict';

var CleanCSS = require('clean-css');
var clone = require('lodash/lang/cloneDeep');
var assign = require('lodash/object/assign');
var dirname = require('path').dirname;
var through = require('through2');

function cleanCSSPlugin(path, file, config) {
    var options = assign(clone(config.cleanCSS || {}), {
        relativeTo: dirname(path)
    });
    var cleaner = new CleanCSS(options);
    var code = new Buffer('');

    if (config.debug) { return file; }

    return file.pipe(through(function concat(chunk, encoding, next) {
        code = Buffer.concat([code, chunk]);
        next();
    }, function minify(done) {
        var stream = this;

        cleaner.minify(code.toString(), function finish(error, minified) {
            if (error) { return stream.emit('error', error); }

            stream.push(minified.styles);
            done();
        });
    }));
}

module.exports = cleanCSSPlugin;
