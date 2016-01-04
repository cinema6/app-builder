'use strict';

var trumpet = require('trumpet');
var parseURL = require('url').parse;
var resolvePath = require('path').resolve;
var dirname = require('path').dirname;
var fs = require('fs-extra');
var CombinedStream = require('combined-stream2');
var replaceStream = require('replacestream');
var relativePath = require('path').relative;
var resolveURL = require('url').resolve;

var config = JSON.parse(process.argv[2]);
var plugins = (function(plugins) {
    return {
        js: plugins.js.map(require),
        css: plugins.css.map(require)
    };
}(JSON.parse(process.argv[3])));
var parser = trumpet();

function isRelative(path) {
    return !parseURL(path).host && path.charAt(0) !== '/';
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

process.stdin.pipe(parser).pipe(process.stdout);
