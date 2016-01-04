'use strict';

var UglifyJS = require('uglify-js');
var through = require('through2');
var assign = require('lodash/object/assign');
var clone = require('lodash/lang/cloneDeep');
var pump = require('pump');

function uglifyPlugin(path, file, config, callback) {
    var code = new Buffer('');
    var options = assign(clone(config.uglify || {}), {
        fromString: true
    });

    if (config.debug) { return file; }

    return pump(file, through(function collect(chunk, encoding, callback) {
        code = Buffer.concat([code, chunk]);
        callback();
    }, function minify(callback) {
        this.push(UglifyJS.minify(code.toString(), options).code);
        callback();
    }), callback);
}

module.exports = uglifyPlugin;
