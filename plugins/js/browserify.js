'use strict';

var browserify = require('browserify');
var omit = require('lodash/object/omit');
var assign = require('lodash/object/assign');
var dirname = require('path').dirname;

function browserifyPlugin(path, file, config) {
    var browserifyConfig = config.browserify || {};
    var options = assign(omit(browserifyConfig.options, ['entries']), {
        basedir: dirname(path),
        debug: config.debug
    });
    var plugins = browserifyConfig.plugins || [];
    var transforms = browserifyConfig.transforms || [];
    var builder = browserify(options);

    plugins.forEach(function(plugin) {
        builder.plugin.apply(builder, plugin);
    });
    transforms.forEach(function(transform) {
        builder.transform.apply(builder, transform);
    });

    builder.add(file);

    return builder.bundle();
}

module.exports = browserifyPlugin;
