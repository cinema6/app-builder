'use strict';

var proxyquire = require('proxyquire');

describe('AppBuilder', function() {
    var stubs;

    var AppBuilder;
    var browserifyPlugin;
    var uglifyPlugin;
    var cleanCSSPlugin;

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
            'child_process': {
                spawn: jasmine.createSpy('child_process.spawn()').and.callFake(function() {
                    return {
                        stdin: new MockWritable(),
                        stdout: new MockReadable(MOCKS.html),
                        stderr: new MockReadable('')
                    };
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

                beforeEach(function() {
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

                    result = builder.build(entry);
                    child = spawn.calls.mostRecent() && spawn.calls.mostRecent().returnValue;
                });

                it('should spawn a process to perform the build', function() {
                    expect(spawn).toHaveBeenCalledWith(process.execPath, [require.resolve('../../lib/workers/build.js'), JSON.stringify(builder.config), JSON.stringify(builder.plugins)]);
                });

                it('should pipe() the entry to the worker', function() {
                    expect(entry.pipe).toHaveBeenCalledWith(child.stdin);
                });

                it('should return the child\'s stdout stream', function() {
                    expect(result).toBe(child.stdout);
                });

                describe('if the entry is a path', function() {
                    beforeEach(function() {
                        builder = new AppBuilder();
                        spawn.calls.reset();
                        entry = require.resolve('../helpers/assets/index.html');

                        result = builder.build(entry);
                        child = spawn.calls.mostRecent() && spawn.calls.mostRecent().returnValue;
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

                    it('should return the child\'s stdout stream', function() {
                        expect(result).toBe(child.stdout);
                    });
                });
            });
        });
    });
});
