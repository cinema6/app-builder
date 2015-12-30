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

function isRelative(path) {
    return !parseURL(path).host && path.charAt(0) !== '/';
}

function AppBuilder(config) {
    this.config = config;

    this.plugins = {
        js: [],
        css: []
    };
}

AppBuilder.prototype.build = function build(entry) {
    var parser = trumpet();
    var config = this.config;
    var plugins = this.plugins;
    var baseDir = config.baseDir;
    var baseURL = config.baseURL;

    parser.selectAll('link[rel="stylesheet"]', function getStylesheet(link) {
        var href = link.getAttribute('href');
        var path, folder, file, html;

        if (!isRelative(href)) { return; }

        path = resolvePath(baseDir, href);
        folder = dirname(path);
        file = plugins.css.reduce(function(file, plugin) {
            return plugin(path, file, config);
        }, fs.createReadStream(path));
        html = CombinedStream.create();

        html.append(new Buffer('<style data-href="' + href + '">'));
        html.append(file.pipe(replaceStream(/url\(['"]?(.+?)['"]?\)/g, function(match, url) {
            var relative = isRelative(url);
            var newURL = relative ? ('./' + relativePath(baseDir, resolvePath(folder, url))) : url;

            return 'url(' + newURL + ')';
        })));
        html.append(new Buffer('</style>'));

        html.pipe(link.createWriteStream({ outer: true }));
    });

    parser.selectAll('script[src]', function getScript(script) {
        var src = script.getAttribute('src');
        var path, file;

        if (!isRelative(src)) { return; }

        path = resolvePath(baseDir, src);
        file = plugins.js.reduce(function(file, plugin) {
            return plugin(path, file, config);
        }, fs.createReadStream(path));

        script.setAttribute('data-src', src);
        script.removeAttribute('src');

        file.pipe(replaceStream(/<\/script>/g, '<\\/script>')).pipe(script.createWriteStream());
    });

    if (baseURL) {
        parser.selectAll('head base', function modifyBase(base) {
            base.setAttribute('href', resolveURL(baseURL, base.getAttribute('href')));
        });
    }

    return entry.pipe(parser);
};

module.exports = AppBuilder;
