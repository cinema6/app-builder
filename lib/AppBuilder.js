'use strict';

var trumpet = require('trumpet');
var resolvePath = require('path').resolve;
var resolveURL = require('url').resolve;
var relativePath = require('path').relative;
var dirname = require('path').dirname;
var fs = require('fs-extra');
var CombinedStream = require('combined-stream2');
var parseURL = require('url').parse;
var replaceStream = require('replacestream');

var plugins = {
    browserify: require('../plugins/js/browserify'),
    uglify: require('../plugins/js/uglify'),
    cleanCSS: require('../plugins/css/clean')
};

function isRelative(path) {
    return !parseURL(path).host && path.charAt(0) !== '/';
}

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
    var parser = trumpet();
    var config = this.config;
    var plugins = this.plugins;

    if (isPath) {
        this.config.baseDir = dirname(arguments[0]);
    }

    parser.selectAll('link[rel="stylesheet"]', function getStylesheet(link) {
        var href = link.getAttribute('href');
        var path, folder, file, html;

        if (!isRelative(href)) { return; }

        path = resolvePath(config.baseDir, href);
        folder = dirname(path);
        file = plugins.css.reduce(function(file, plugin) {
            return plugin(path, file, config);
        }, fs.createReadStream(path));
        html = CombinedStream.create();

        html.append(new Buffer('<style data-href="' + href + '">'));
        html.append(file.pipe(replaceStream(/url\(['"]?(.+?)['"]?\)/g, function(match, url) {
            var relative = isRelative(url);
            var newURL = relative ?
                ('./' + relativePath(config.baseDir, resolvePath(folder, url))) :
                url;

            return 'url(' + newURL + ')';
        })));
        html.append(new Buffer('</style>'));

        html.pipe(link.createWriteStream({ outer: true }));
    });

    parser.selectAll('script[src]', function getScript(script) {
        var src = script.getAttribute('src');
        var path, file;

        if (!isRelative(src)) { return; }

        path = resolvePath(config.baseDir, src);
        file = plugins.js.reduce(function(file, plugin) {
            return plugin(path, file, config);
        }, fs.createReadStream(path));

        script.setAttribute('data-src', src);
        script.removeAttribute('src');

        file.pipe(replaceStream(/<\/script>/g, '<\\/script>')).pipe(script.createWriteStream());
    });

    if (config.baseURL) {
        parser.selectAll('head base', function modifyBase(base) {
            base.setAttribute('href', resolveURL(config.baseURL, base.getAttribute('href')));
        });
    }

    return entry.pipe(parser);
};

module.exports = AppBuilder;
