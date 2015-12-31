'use strict';

describe('AppBuilder', function() {
    var AppBuilder;
    var browserifyPlugin;
    var uglifyPlugin;

    var fs;
    var MockReadable;
    var Readable;
    var streamToPromise;
    var path;
    var CombinedStream;
    var cheerio;
    var url;

    var MOCKS;

    beforeEach(function() {
        AppBuilder = require('../../lib/AppBuilder');
        browserifyPlugin = require('../../plugins/js/browserify');
        uglifyPlugin = require('../../plugins/js/uglify');

        fs = require('fs-extra');
        MockReadable = require('../helpers/MockReadable');
        Readable = require('stream').Readable;
        streamToPromise = require('stream-to-promise');
        path = require('path');
        CombinedStream = require('combined-stream2');
        cheerio = require('cheerio');
        url = require('url');

        MOCKS = {
            html: fs.readFileSync(require.resolve('../helpers/assets/index.html')).toString()
        };
        MOCKS[require.resolve('../helpers/assets/css/main.css')] = fs.readFileSync(require.resolve('../helpers/assets/css/main.css')).toString();
        MOCKS[require.resolve('../helpers/assets/css/normalize.css')] = fs.readFileSync(require.resolve('../helpers/assets/css/normalize.css')).toString();
        MOCKS[require.resolve('../helpers/assets/js/es6-promise.js')] = fs.readFileSync(require.resolve('../helpers/assets/js/es6-promise.js')).toString();
        MOCKS[require.resolve('../helpers/assets/js/main.js')] = fs.readFileSync(require.resolve('../helpers/assets/js/main.js')).toString();
    });

    it('should exist', function() {
        expect(AppBuilder).toEqual(jasmine.any(Function));
        expect(AppBuilder.name).toBe('AppBuilder');
    });

    describe('instance:', function() {
        var config;
        var builder;

        beforeEach(function() {
            config = {
                baseDir: path.resolve(__dirname, '../helpers/assets')
            };

            builder = new AppBuilder(config);
        });

        describe('properties:', function() {
            describe('config', function() {
                it('should be the provided config', function() {
                    expect(builder.config).toBe(config);
                });
            });

            describe('plugins', function() {
                it('should be an Object', function() {
                    expect(builder.plugins).toEqual(jasmine.any(Object));
                });

                describe('.js', function() {
                    it('should be an Array of Functions', function() {
                        expect(builder.plugins.js).toEqual([browserifyPlugin, uglifyPlugin]);
                    });
                });

                describe('.css', function() {
                    it('should be an Array of Functions', function() {
                        expect(builder.plugins.css).toEqual([]);
                    });
                });
            });
        });

        describe('methods:', function() {
            describe('build(entry)', function() {
                var entry;
                var result;
                var fsReadStreams;
                var $old, $new;

                var prependCSS, appendCSS;
                var prependJS, appendJS;

                beforeEach(function(done) {
                    entry = new MockReadable(MOCKS.html);

                    prependCSS = jasmine.createSpy('prependCSS()').and.callFake(function(path, file) {
                        var combined = CombinedStream.create();

                        combined.append(new Buffer('HELLO '));
                        combined.append(file);

                        return combined;
                    });
                    appendCSS = jasmine.createSpy('appendCSS()').and.callFake(function(path, file) {
                        var combined = CombinedStream.create();

                        combined.append(file);
                        combined.append(new Buffer(' WORLD!'));

                        return combined;
                    });

                    prependJS = jasmine.createSpy('prependJS()').and.callFake(function(path, file) {
                        var combined = CombinedStream.create();

                        combined.append(new Buffer('/* HELLO */'));
                        combined.append(file);

                        return combined;
                    });
                    appendJS = jasmine.createSpy('appendJS()').and.callFake(function(path, file) {
                        var combined = CombinedStream.create();

                        combined.append(file);
                        combined.append(new Buffer('/* WORLD! */'));

                        return combined;
                    });

                    builder.plugins.css = [prependCSS, appendCSS];
                    builder.plugins.js = [prependJS, appendJS];

                    fsReadStreams = {};
                    spyOn(fs, 'createReadStream').and.callFake(function(path) {
                        var data = MOCKS[path];

                        if (data) {
                            return (fsReadStreams[path] = new MockReadable(data));
                        } else {
                            throw new Error('File not found!');
                        }
                    });

                    $old = cheerio.load(MOCKS.html);

                    result = builder.build(entry);
                    streamToPromise(result).then(function(data) {
                        return ($new = cheerio.load(data.toString()));
                    }).then(done, done.fail);
                });

                it('should contain the same number of nodes', function() {
                    expect($new('*').length).toBe($old('*').length);
                });

                it('should create streams for each CSS asset', function() {
                    expect(fs.createReadStream).toHaveBeenCalledWith(require.resolve('../helpers/assets/css/main.css'));
                    expect(fs.createReadStream).toHaveBeenCalledWith(require.resolve('../helpers/assets/css/normalize.css'));
                });

                it('should call each CSS plugin with each CSS file', function() {
                    expect(prependCSS).toHaveBeenCalledWith(require.resolve('../helpers/assets/css/normalize.css'), fsReadStreams[require.resolve('../helpers/assets/css/normalize.css')], builder.config);
                    expect(appendCSS).toHaveBeenCalledWith(require.resolve('../helpers/assets/css/normalize.css'), prependCSS.calls.all()[0].returnValue, builder.config);

                    expect(prependCSS).toHaveBeenCalledWith(require.resolve('../helpers/assets/css/main.css'), fsReadStreams[require.resolve('../helpers/assets/css/main.css')], builder.config);
                    expect(appendCSS).toHaveBeenCalledWith(require.resolve('../helpers/assets/css/main.css'), prependCSS.calls.all()[1].returnValue, builder.config);

                    expect(prependCSS.calls.count()).toBe(2);
                    expect(appendCSS.calls.count()).toBe(2);
                });

                it('should inline the CSS assets', function() {
                    var $css1 = $new($new('style')[0]);
                    var $css2 = $new($new('style')[1]);

                    expect($css1.attr('data-href')).toBe('css/normalize.css');
                    expect($css2.attr('data-href')).toBe('css/main.css');

                    expect($css1.text()).toBe('HELLO ' + MOCKS[require.resolve('../helpers/assets/css/normalize.css')] + ' WORLD!');
                    expect($css2.text()).toBe(
                        ('HELLO ' + MOCKS[require.resolve('../helpers/assets/css/main.css')] + ' WORLD!')
                            .replace('url(\'../img/main.jpg\')', 'url(./img/main.jpg)')
                            .replace('url("../img/aside.jpg")', 'url(./img/aside.jpg)')
                            .replace('url(../img/footer.jpg)', 'url(./img/footer.jpg)')
                            .replace('url(h1.jpg)', 'url(./css/h1.jpg)')
                            .replace('url(\'/foo.jpg\')', 'url(/foo.jpg)')
                            .replace('url("http://www.reelcontent.com/foo.jpg")', 'url(http://www.reelcontent.com/foo.jpg)')
                    );
                });

                it('should create streams for each JS asset', function() {
                    expect(fs.createReadStream).toHaveBeenCalledWith(require.resolve('../helpers/assets/js/es6-promise.js'));
                    expect(fs.createReadStream).toHaveBeenCalledWith(require.resolve('../helpers/assets/js/main.js'));
                });

                it('should call each JS plugin with each JS file', function() {
                    expect(prependJS).toHaveBeenCalledWith(require.resolve('../helpers/assets/js/es6-promise.js'), fsReadStreams[require.resolve('../helpers/assets/js/es6-promise.js')], builder.config);
                    expect(appendJS).toHaveBeenCalledWith(require.resolve('../helpers/assets/js/es6-promise.js'), prependJS.calls.all()[0].returnValue, builder.config);

                    expect(prependJS).toHaveBeenCalledWith(require.resolve('../helpers/assets/js/main.js'), fsReadStreams[require.resolve('../helpers/assets/js/main.js')], builder.config);
                    expect(appendJS).toHaveBeenCalledWith(require.resolve('../helpers/assets/js/main.js'), prependJS.calls.all()[1].returnValue, builder.config);

                    expect(prependJS.calls.count()).toBe(2);
                    expect(appendJS.calls.count()).toBe(2);
                });

                it('should inline the JS assets', function() {
                    var $js1 = $new($new('script')[0]);
                    var $js2 = $new($new('script')[1]);

                    expect($js1.attr('data-src')).toBe('./js/es6-promise.js');
                    expect($js2.attr('data-src')).toBe('js/main.js');

                    expect($js1.attr('src')).toBeUndefined();
                    expect($js2.attr('src')).toBeUndefined();

                    expect($js1.text()).toBe('/* HELLO */' + MOCKS[require.resolve('../helpers/assets/js/es6-promise.js')] + '/* WORLD! */');
                    expect($js2.text()).toBe(
                        ('/* HELLO */' + MOCKS[require.resolve('../helpers/assets/js/main.js')] + '/* WORLD! */')
                            .replace(/<\/script>/g, '<\\/script>')
                    );
                });

                it('should only inline local scripts/stylesheets', function() {
                    expect(fs.createReadStream.calls.count()).toBe(4);
                });

                describe('if a baseURL is specified', function() {
                    beforeEach(function(done) {
                        config.baseURL = 'https://platform.reelcontent.com/apps/mini-reel-player/v1.0.0/';

                        entry = new MockReadable(MOCKS.html);
                        builder = new AppBuilder(config);
                        result = builder.build(entry);
                        streamToPromise(result).then(function(data) {
                            return ($new = cheerio.load(data.toString()));
                        }).then(done, done.fail);
                    });

                    it('should not add a <base> tag to the page', function() {
                        expect($new('base').length).toBe(0);
                    });

                    describe('and the document has a <base> already', function() {
                        beforeEach(function(done) {
                            $old = cheerio.load(MOCKS.html);
                            $old('head').prepend('<base href="assets/foo"/>');

                            entry = new MockReadable($old.html());
                            builder = new AppBuilder(config);
                            result = builder.build(entry);
                            streamToPromise(result).then(function(data) {
                                return ($new = cheerio.load(data.toString()));
                            }).then(done, done.fail);
                        });

                        it('should merge the <base> tags', function() {
                            var $base = $new('base');

                            expect($base.attr('href')).toBe(url.resolve(config.baseURL, 'assets/foo'));
                            expect($base.length).toBe(1);
                        });
                    });
                });
            });
        });
    });
});
