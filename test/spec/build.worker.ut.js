'use strict';

var proxyquire = require('proxyquire');

describe('build.js', function() {
    var fs;
    var url;
    var path;
    var cheerio;
    var MockReadable;
    var MockWritable;
    var Bluebird;
    var CombinedStream;
    var Module;

    var stubs;
    var success, failure;
    var prependCSS, appendCSS;
    var prependJS, appendJS;
    var fsReadStreams;
    var $new, $old;
    var MOCKS;
    var handleError;
    var exitDescriptor;

    var file, config, plugins;

    function build(file, config, plugins) {
        var stdinDescriptor = Object.getOwnPropertyDescriptor(process, 'stdin');
        var stdoutDescriptor = Object.getOwnPropertyDescriptor(process, 'stdout');
        var argvDescriptor = Object.getOwnPropertyDescriptor(process, 'argv');

        return new Bluebird(function(resolve, reject) {
            Object.defineProperties(process, {
                stdin: {
                    value: file,
                    configurable: true,
                    enumerable: true
                },
                stdout: {
                    value: new MockWritable(),
                    configurable: true,
                    enumerable: true
                },
                argv: {
                    value: [process.execPath, require.resolve('../../lib/workers/build.js'), JSON.stringify(config), JSON.stringify(plugins)],
                    configurable: true,
                    enumerable: true
                }
            });

            proxyquire('../../lib/workers/build', stubs);

            process.stdout.on('removeListener', function(event) {
                if (event === 'finish') { resolve(process.stdout.data); }
            });
            process.stdout.once('error', function(error) {
                reject(error);
            });
        }).finally(function cleanup() {
            Object.defineProperties(process, {
                stdin: stdinDescriptor,
                stdout: stdoutDescriptor,
                argv: argvDescriptor
            });
        });
    }

    beforeEach(function(done) {
        exitDescriptor = Object.getOwnPropertyDescriptor(process, 'exit');

        Object.defineProperties(process, {
            exit: {
                value: jasmine.createSpy('process.exit()'),
                configurable: true,
                enumerable: true
            }
        });

        stubs = {
            'pump': jasmine.createSpy('pump()').and.callFake(require('pump')),

            '@noCallThru': true
        };

        success = jasmine.createSpy('success()').and.callFake(function(html) {
            $new = cheerio.load(html.toString());
            return html.toString();
        });
        failure = jasmine.createSpy('failure()');

        fs = require('fs-extra');
        url = require('url');
        path = require('path');
        cheerio = require('cheerio');
        MockReadable = require('../helpers/MockReadable');
        MockWritable = require('../helpers/MockWritable');
        Bluebird = require('bluebird');
        CombinedStream = require('combined-stream2');
        Module = require('module');

        MOCKS = {
            html: fs.readFileSync(require.resolve('../helpers/assets/index.html')).toString()
        };
        MOCKS[require.resolve('../helpers/assets/index.html')] = MOCKS.html;
        MOCKS[require.resolve('../helpers/assets/css/main.css')] = fs.readFileSync(require.resolve('../helpers/assets/css/main.css')).toString();
        MOCKS[require.resolve('../helpers/assets/css/normalize.css')] = fs.readFileSync(require.resolve('../helpers/assets/css/normalize.css')).toString();
        MOCKS[require.resolve('../helpers/assets/js/es6-promise.js')] = fs.readFileSync(require.resolve('../helpers/assets/js/es6-promise.js')).toString();
        MOCKS[require.resolve('../helpers/assets/js/main.js')] = fs.readFileSync(require.resolve('../helpers/assets/js/main.js')).toString();


        file = new MockReadable(MOCKS.html);
        config = {
            baseDir: path.resolve(__dirname, '../helpers/assets')
        };
        plugins = {
            js: [
                path.resolve(__dirname, '../../plugins/js/prepend.js'),
                path.resolve(__dirname, '../../plugins/js/append.js')
            ],
            css: [
                path.resolve(__dirname, '../../plugins/css/prepend.js'),
                path.resolve(__dirname, '../../plugins/css/append.js')
            ]
        };

        fsReadStreams = {};
        spyOn(fs, 'createReadStream').and.callFake(function(path) {
            var data = MOCKS[path];

            if (data) {
                return (fsReadStreams[path] = new MockReadable(data));
            } else {
                throw new Error('File not found!');
            }
        });

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

        [].concat(plugins.js, plugins.css).forEach(function(path) {
            require.cache[path] = { id: path, exports: {}, filename: path, loaded: true };
        });

        var _resolveFilename = Module._resolveFilename;
        spyOn(Module, '_resolveFilename').and.callFake(function(request) {
            if ([].concat(plugins.js, plugins.css).indexOf(request) > -1) {
                return request;
            }

            return _resolveFilename.apply(this, arguments);
        });

        stubs[plugins.js[0]] = prependJS;
        stubs[plugins.js[1]] = appendJS;
        stubs[plugins.css[0]] = prependCSS;
        stubs[plugins.css[1]] = appendCSS;

        $old = cheerio.load(MOCKS.html);

        build(file, config, plugins).then(success, failure).finally(done);
        handleError = stubs.pump.calls.mostRecent().args[stubs.pump.calls.mostRecent().args.length - 1];
    });

    afterEach(function() {
        Object.defineProperties(process, {
            exit: exitDescriptor
        });
    });

    it('should use the same error handler for each stream', function() {
        expect(stubs.pump.calls.count()).toBeGreaterThan(0);
        expect(stubs.pump.calls.all().slice(1).every(function(call) {
            var lastArg = call.args[call.args.length - 1];
            var firstFn = stubs.pump.calls.all()[0].args[stubs.pump.calls.all()[0].args.length - 1];

            return (typeof lastArg === 'function') && lastArg === firstFn;
        })).toBe(true);
    });

    it('should contain the same number of nodes', function() {
        expect($new('*').length).toBe($old('*').length);
    });

    it('should create streams for each CSS asset', function() {
        expect(fs.createReadStream).toHaveBeenCalledWith(require.resolve('../helpers/assets/css/main.css'));
        expect(fs.createReadStream).toHaveBeenCalledWith(require.resolve('../helpers/assets/css/normalize.css'));
    });

    it('should call each CSS plugin with each CSS file', function() {
        expect(prependCSS).toHaveBeenCalledWith(require.resolve('../helpers/assets/css/normalize.css'), fsReadStreams[require.resolve('../helpers/assets/css/normalize.css')], config, handleError);
        expect(appendCSS).toHaveBeenCalledWith(require.resolve('../helpers/assets/css/normalize.css'), prependCSS.calls.all()[0].returnValue, config, handleError);

        expect(prependCSS).toHaveBeenCalledWith(require.resolve('../helpers/assets/css/main.css'), fsReadStreams[require.resolve('../helpers/assets/css/main.css')], config, handleError);
        expect(appendCSS).toHaveBeenCalledWith(require.resolve('../helpers/assets/css/main.css'), prependCSS.calls.all()[1].returnValue, config, handleError);

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
        expect(prependJS).toHaveBeenCalledWith(require.resolve('../helpers/assets/js/es6-promise.js'), fsReadStreams[require.resolve('../helpers/assets/js/es6-promise.js')], config, handleError);
        expect(appendJS).toHaveBeenCalledWith(require.resolve('../helpers/assets/js/es6-promise.js'), prependJS.calls.all()[0].returnValue, config, handleError);

        expect(prependJS).toHaveBeenCalledWith(require.resolve('../helpers/assets/js/main.js'), fsReadStreams[require.resolve('../helpers/assets/js/main.js')], config, handleError);
        expect(appendJS).toHaveBeenCalledWith(require.resolve('../helpers/assets/js/main.js'), prependJS.calls.all()[1].returnValue, config, handleError);

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
            success.calls.reset();
            failure.calls.reset();
            config.baseURL = 'https://platform.reelcontent.com/apps/mini-reel-player/v1.0.0/';

            file = new MockReadable(MOCKS.html);
            build(file, config, plugins).then(success, failure).finally(done);
        });

        it('should not add a <base> tag to the page', function() {
            expect($new('base').length).toBe(0);
        });

        describe('and the document has a <base> already', function() {
            beforeEach(function(done) {
                success.calls.reset();
                failure.calls.reset();

                $old = cheerio.load(MOCKS.html);
                $old('head').prepend('<base href="assets/foo"/>');

                file = new MockReadable($old.html());
                build(file, config, plugins).then(success, failure).finally(done);
            });

            it('should merge the <base> tags', function() {
                var $base = $new('base');

                expect($base.attr('href')).toBe(url.resolve(config.baseURL, 'assets/foo'));
                expect($base.length).toBe(1);
            });

            describe('without an href', function() {
                beforeEach(function(done) {
                    success.calls.reset();
                    failure.calls.reset();

                    $old('head base').removeAttr('href');

                    file = new MockReadable($old.html());
                    build(file, config, plugins).then(success, failure).finally(done);
                });

                it('should give the <base> an href that is equal to the baseURL', function() {
                    expect($new('base').attr('href')).toBe(config.baseURL);
                });
            });
        });
    });

    describe('when a stream closes', function() {
        beforeEach(function() {
            spyOn(process.stderr, 'write');
        });

        describe('without an error', function() {
            beforeEach(function() {
                handleError(null);
            });

            it('should write nothing to stderr', function() {
                expect(process.stderr.write).not.toHaveBeenCalled();
            });

            it('should not exit the process', function() {
                expect(process.exit).not.toHaveBeenCalled();
            });
        });

        describe('with an error', function() {
            var error;

            beforeEach(function() {
                error = new Error('There was a problem!');

                handleError(error);
            });

            it('should write to stderr', function() {
                expect(process.stderr.write).toHaveBeenCalledWith(require('util').inspect(error));
            });

            it('should exit the process with code 1', function() {
                expect(process.exit).toHaveBeenCalledWith(1);
            });
        });
    });
});
