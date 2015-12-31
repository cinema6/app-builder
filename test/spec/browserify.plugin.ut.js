'use strict';

var proxyquire = require('proxyquire');

describe('browserifyPlugin()', function() {
    var browserifyPlugin;
    var MockReadable;
    var fs;

    var stubs;

    beforeEach(function() {
        MockReadable = require('../helpers/MockReadable');
        fs = require('fs-extra');

        stubs = {
            'browserify': jasmine.createSpy('browserify()').and.callFake(function() {
                var builder = require('browserify').apply(null, arguments);

                spyOn(builder, 'add').and.returnValue(builder);
                spyOn(builder, 'transform').and.returnValue(builder);
                spyOn(builder, 'plugin').and.returnValue(builder);
                spyOn(builder, 'bundle').and.returnValue(new MockReadable('THIS IS MY BUNDLE!'));

                return builder;
            }),

            '@noCallThru': true
        };
        browserifyPlugin = proxyquire('../../plugins/js/browserify', stubs);
    });

    it('should exist', function() {
        expect(browserifyPlugin).toEqual(jasmine.any(Function));
        expect(browserifyPlugin.name).toBe('browserifyPlugin');
    });

    describe('when called', function() {
        var path, file, config;
        var builder;
        var result;

        beforeEach(function() {
            path = require.resolve('../helpers/assets/js/main.js');
            file = new MockReadable(fs.readFileSync(path).toString());
            config = {
                debug: false,
                baseDir: require('path').resolve(__dirname, '../helpers/assets'),

                browserify: {
                    options: {
                        entries: ['file.js'],
                        noParse: ['jquery'],
                        extensions: ['.js', '.es6'],
                        basedir: 'some-dir',
                        paths: ['some/path'],
                        commondir: false,
                        fullPaths: true,
                        builtins: ['process'],
                        bundleExternal: false,
                        insertGlobals: true,
                        detectGlobals: false,
                        debug: true,
                        standalone: true,
                        insertGlobalVars: 'foo',
                        externalRequireName: 'require'
                    },

                    plugins: [
                        ['proxyquireify', { foo: 'bar' }],
                        ['pluginify']
                    ],

                    transforms: [
                        ['uglifyify', { foo: 'bar' }],
                        ['babelify']
                    ]
                }
            };

            result = browserifyPlugin(path, file, config);
            builder = stubs.browserify.calls.mostRecent().returnValue;
        });

        it('should create a new browserify instance', function() {
            expect(stubs.browserify).toHaveBeenCalledWith({
                noParse: ['jquery'],
                extensions: ['.js', '.es6'],
                basedir: require('path').dirname(path),
                paths: ['some/path'],
                commondir: false,
                fullPaths: true,
                builtins: ['process'],
                bundleExternal: false,
                insertGlobals: true,
                detectGlobals: false,
                debug: false,
                standalone: true,
                insertGlobalVars: 'foo',
                externalRequireName: 'require'
            });
        });

        it('should add all the plugins', function() {
            config.browserify.plugins.forEach(function(row) {
                var expecter = expect(builder.plugin);

                expecter.toHaveBeenCalledWith.apply(expecter, row);
            });
        });

        it('should add all the transforms', function() {
            config.browserify.transforms.forEach(function(row) {
                var expecter = expect(builder.transform);

                expecter.toHaveBeenCalledWith.apply(expecter, row);
            });
        });

        it('should add the file', function() {
            expect(builder.add).toHaveBeenCalledWith(file);
        });

        it('should call bundle()', function() {
            expect(builder.bundle).toHaveBeenCalledWith();
        });

        it('should return the bundle stream', function() {
            expect(result).toBe(builder.bundle.calls.mostRecent().returnValue);
        });

        describe('if no configuration is provided', function() {
            beforeEach(function() {
                delete config.browserify;
                stubs.browserify.calls.reset();

                result = browserifyPlugin(path, file, config);
                builder = stubs.browserify.calls.mostRecent().returnValue;
            });

            it('should pass minimal configuration to browserify', function() {
                expect(stubs.browserify).toHaveBeenCalledWith({
                    debug: config.debug,
                    basedir: require('path').dirname(path)
                });
            });

            it('should add the file', function() {
                expect(builder.add).toHaveBeenCalledWith(file);
            });

            it('should add no plugins or transforms', function() {
                expect(builder.plugin).not.toHaveBeenCalled();
                expect(builder.transform).not.toHaveBeenCalled();
            });

            it('should return the bundle stream', function() {
                expect(result).toBe(builder.bundle.calls.mostRecent().returnValue);
            });
        });
    });
});
