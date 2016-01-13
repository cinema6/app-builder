'use strict';

var proxyquire = require('proxyquire');

describe('AppBuilder', function() {
    var stubs;

    var AppBuilder;
    var browserifyPlugin;
    var uglifyPlugin;
    var cleanCSSPlugin;

    var EventEmitter;
    var fs;
    var MockReadable;
    var MockWritable;
    var Readable;
    var streamToPromise;
    var path;
    var CombinedStream;
    var cheerio;
    var url;

    var MOCKS;
    var spawn;

    beforeEach(function() {
        stubs = {
            'pump': jasmine.createSpy('pump()').and.callFake(require('pump')),

            'child_process': {
                spawn: jasmine.createSpy('child_process.spawn()').and.callFake(function() {
                    var child = new EventEmitter();

                    child.stdin = new MockWritable();
                    child.stdout = new MockReadable(MOCKS.html);
                    child.stderr = new MockReadable('');

                    return child;
                })
            }
        };

        /* jshint camelcase:false */
        spawn = stubs.child_process.spawn;
        /* jshint camelcase:true */

        AppBuilder = proxyquire('../../lib/AppBuilder', stubs);
        browserifyPlugin = require('../../plugins/js/browserify');
        uglifyPlugin = require('../../plugins/js/uglify');
        cleanCSSPlugin = require('../../plugins/css/clean');

        EventEmitter = require('events').EventEmitter;
        fs = require('fs-extra');
        MockReadable = require('../helpers/MockReadable');
        MockWritable = require('../helpers/MockWritable');
        Readable = require('stream').Readable;
        streamToPromise = require('stream-to-promise');
        path = require('path');
        CombinedStream = require('combined-stream2');
        cheerio = require('cheerio');
        url = require('url');

        MOCKS = {
            html: fs.readFileSync(require.resolve('../helpers/assets/index.html')).toString()
        };
        MOCKS[require.resolve('../helpers/assets/index.html')] = MOCKS.html;
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

        it('should be an EventEmitter', function() {
            expect(builder).toEqual(jasmine.any(EventEmitter));
        });

        describe('if plugins.js are specified', function() {
            beforeEach(function() {
                config.plugins = {
                    js: ['plugin1', 'plugin2']
                };

                builder = new AppBuilder(config);
            });

            it('should override the js plugins', function() {
                expect(builder.plugins.js).toEqual(config.plugins.js);
                expect(builder.plugins.css).toEqual([require.resolve('../../plugins/css/clean')]);
            });
        });

        describe('if plugins.css are specified', function() {
            beforeEach(function() {
                config.plugins = {
                    css: ['plugin1', 'plugin2']
                };

                builder = new AppBuilder(config);
            });

            it('should override the css plugins', function() {
                expect(builder.plugins.css).toEqual(config.plugins.css);
                expect(builder.plugins.js).toEqual([require.resolve('../../plugins/js/browserify'), require.resolve('../../plugins/js/uglify')]);
            });
        });

        describe('properties:', function() {
            describe('config', function() {
                it('should equal the provided config', function() {
                    expect(builder.config).toEqual(config);
                    expect(builder.config).not.toBe(config);
                });
            });

            describe('plugins', function() {
                it('should be an Object', function() {
                    expect(builder.plugins).toEqual(jasmine.any(Object));
                });

                describe('.js', function() {
                    it('should be an Array of paths', function() {
                        expect(builder.plugins.js).toEqual([require.resolve('../../plugins/js/browserify.js'), require.resolve('../../plugins/js/uglify.js')]);
                    });
                });

                describe('.css', function() {
                    it('should be an Array of paths', function() {
                        expect(builder.plugins.css).toEqual([require.resolve('../../plugins/css/clean.js')]);
                    });
                });
            });
        });

        describe('methods:', function() {
            describe('build(entry)', function() {
                var entry;
                var result;
                var child, fsReadStreams;
                var success, failure;

                beforeEach(function(done) {
                    entry = new MockReadable(MOCKS.html);
                    spyOn(entry, 'pipe').and.callThrough();

                    fsReadStreams = {};
                    spyOn(fs, 'createReadStream').and.callFake(function(path) {
                        var data = MOCKS[path];
                        var stream;

                        if (data) {
                            stream = fsReadStreams[path] = new MockReadable(data);
                            spyOn(stream, 'pipe').and.callThrough();
                            return stream;
                        } else {
                            throw new Error('File not found!');
                        }
                    });

                    success = jasmine.createSpy('success()');
                    failure = jasmine.createSpy('failure()');

                    result = builder.build(entry);
                    streamToPromise(result).then(function(data) { return data.toString(); }).then(success, failure).finally(done);
                    entry.on('end', function() {
                        process.nextTick(function() { child.emit('exit', 0); });
                    });

                    child = spawn.calls.mostRecent() && spawn.calls.mostRecent().returnValue;
                });

                it('should use the same error handler for each stream', function() {
                    expect(stubs.pump.calls.count()).toBeGreaterThan(0);
                    expect(stubs.pump.calls.all().slice(1).every(function(call) {
                        var lastArg = call.args[call.args.length - 1];
                        var firstFn = stubs.pump.calls.all()[0].args[stubs.pump.calls.all()[0].args.length - 1];

                        return (typeof lastArg === 'function') && lastArg === firstFn;
                    })).toBe(true);
                });

                it('should spawn a process to perform the build', function() {
                    expect(spawn).toHaveBeenCalledWith(process.execPath, [require.resolve('../../lib/workers/build.js'), JSON.stringify(builder.config), JSON.stringify(builder.plugins)]);
                });

                it('should pipe() the entry to the worker', function() {
                    expect(entry.pipe).toHaveBeenCalledWith(child.stdin);
                });

                it('should fulfill with the data of the stdout stream', function() {
                    expect(success).toHaveBeenCalledWith(MOCKS.html);
                });

                describe('if the entry is a path', function() {
                    beforeEach(function(done) {
                        success.calls.reset();
                        failure.calls.reset();

                        builder = new AppBuilder();
                        spawn.calls.reset();
                        entry = require.resolve('../helpers/assets/index.html');

                        result = builder.build(entry);
                        streamToPromise(result).then(function(data) { return data.toString(); }).then(success, failure).finally(done);
                        child = spawn.calls.mostRecent() && spawn.calls.mostRecent().returnValue;
                        fsReadStreams[entry].on('end', function() {
                            process.nextTick(function() { child.emit('exit', 0); });
                        });
                    });

                    it('should create a read stream for the file', function() {
                        expect(fs.createReadStream).toHaveBeenCalledWith(entry);
                    });

                    it('should give the config a baseDir', function() {
                        expect(builder.config.baseDir).toBe(path.dirname(entry));
                    });

                    it('should spawn a process to perform the build', function() {
                        expect(spawn).toHaveBeenCalledWith(process.execPath, [require.resolve('../../lib/workers/build.js'), JSON.stringify(builder.config), JSON.stringify(builder.plugins)]);
                    });

                    it('should pipe() the file to the worker', function() {
                        expect(fsReadStreams[entry].pipe).toHaveBeenCalledWith(child.stdin);
                    });

                    it('should fulfill with the data of the stdout stream', function() {
                        expect(success).toHaveBeenCalledWith(MOCKS.html);
                    });
                });

                describe('if the child exits', function() {
                    var errorSpy;
                    var end;

                    beforeEach(function() {
                        success.calls.reset();
                        failure.calls.reset();

                        builder = new AppBuilder();
                        spawn.calls.reset();
                        entry = new MockReadable(MOCKS.html);

                        errorSpy = jasmine.createSpy('error()').and.callFake(function() {
                            expect(end).not.toHaveBeenCalled();
                        });
                        builder.on('error', errorSpy);

                        end = jasmine.createSpy('end()');
                        result = builder.build(entry).on('end', end);
                        result.on('data', function() {});

                        child = spawn.calls.mostRecent() && spawn.calls.mostRecent().returnValue;
                    });

                    [0].forEach(function(code) {
                        describe('if the child exits with code ' + code, function() {
                            beforeEach(function(done) {
                                entry.on('end', function() {
                                    process.nextTick(function() {
                                        child.emit('exit', code);
                                        done();
                                    });
                                });
                            });

                            it('should do nothing', function() {
                                expect(errorSpy).not.toHaveBeenCalled();
                            });
                        });
                    });

                    [1, 2, 3, 4, 5].forEach(function(code) {
                        describe('if the child exits with code ' + code, function() {
                            beforeEach(function(done) {
                                child.stderr.emit('data', new Buffer('Some anoying warning'));
                                child.stderr.emit('data', new Buffer('THIS IS A REAL PROBLEM!'));

                                entry.on('end', function() {
                                    setTimeout(function() {
                                        child.emit('exit', code);
                                        done();
                                    }, 5);
                                });
                            });

                            it('should emit an Error with the last message on stderr', function() {
                                expect(errorSpy).toHaveBeenCalledWith(new Error('THIS IS A REAL PROBLEM!'));
                            });
                        });
                    });
                });

                describe('when a stream closes', function() {
                    var errorSpy;
                    var end;

                    beforeEach(function() {
                        success.calls.reset();
                        failure.calls.reset();

                        builder = new AppBuilder();
                        spawn.calls.reset();
                        entry = new MockReadable(MOCKS.html);

                        errorSpy = jasmine.createSpy('error()').and.callFake(function() {
                            expect(end).not.toHaveBeenCalled();
                        });
                        builder.on('error', errorSpy);

                        end = jasmine.createSpy('end()');
                        result = builder.build(entry).on('end', end);
                        result.on('data', function() {});

                        child = spawn.calls.mostRecent() && spawn.calls.mostRecent().returnValue;
                    });

                    describe('without an error', function() {
                        beforeEach(function(done) {
                            result.on('end', done);
                            child.emit('exit', 0);
                        });

                        it('should not emit the Error event', function() {
                            expect(errorSpy).not.toHaveBeenCalled();
                        });
                    });

                    describe('with an error', function() {
                        var error;

                        beforeEach(function() {
                            error = new Error('There was a problem!');
                            entry.emit('error', error);
                        });

                        it('should emit the Error event', function() {
                            expect(errorSpy).toHaveBeenCalledWith(error);
                        });
                    });
                });
            });
        });
    });
});
