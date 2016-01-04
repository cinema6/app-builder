'use strict';

var proxyquire = require('proxyquire');

describe('cleanCSSPlugin(path, file, config, callback)', function() {
    var cleanCSSPlugin;
    var MockReadable;
    var fs;
    var streamToPromise;
    var clone;

    var stubs;

    beforeEach(function() {
        MockReadable = require('../helpers/MockReadable');
        fs = require('fs-extra');
        streamToPromise = require('stream-to-promise');
        clone = require('lodash/lang/cloneDeep');

        stubs = {
            'pump': jasmine.createSpy('pump()').and.callFake(require('pump')),

            'clean-css': jasmine.createSpy('CleanCSS()').and.callFake(function(options) {
                var CleanCSS = require('clean-css');
                var cleaner = new CleanCSS(clone(options));

                spyOn(cleaner, 'minify');

                return cleaner;
            }),

            '@noCallThru': true
        };

        cleanCSSPlugin = proxyquire('../../plugins/css/clean', stubs);
    });

    it('should exist', function() {
        expect(cleanCSSPlugin).toEqual(jasmine.any(Function));
        expect(cleanCSSPlugin.name).toBe('cleanCSSPlugin');
    });

    describe('when called', function() {
        var code;
        var path, file, config, callback;
        var success, failure;
        var cleaner;
        var result;

        beforeEach(function(done) {
            path = require.resolve('../helpers/assets/css/main.css');
            code = fs.readFileSync(path).toString();
            file = new MockReadable(code);
            config = {
                debug: false,

                cleanCSS: {
                    advanced: true,
                    aggressiveMerging: false,
                    benchmark: false,
                    compatibility: true,
                    debug: false,
                    inliner: { foo: 'bar' },
                    keepBreaks: true,
                    keepSpecialComments: 1,
                    mediaMerging: false,
                    processImport: true,
                    processImportFrom: ['all'],
                    rebase: true,
                    relativeTo: 'some-thing',
                    restructuring: true,
                    root: 'my-root/',
                    roundingPrecision: -1,
                    semanticMerging: false,
                    shorthandCompacting: true,
                    sourceMap: true,
                    sourceMapInlineSources: true,
                    target: 'my-target/'
                }
            };
            callback = jasmine.createSpy('callback()');

            success = jasmine.createSpy('success()');
            failure = jasmine.createSpy('failure()');

            streamToPromise(file).finally(done);

            result = cleanCSSPlugin(path, file, config, callback);
            cleaner = stubs['clean-css'].calls.mostRecent().returnValue;
            streamToPromise(result).then(function(buffer) { return buffer.toString(); }).then(success, failure);
        });

        it('should pass the callback() to pump()', function() {
            expect(stubs.pump.calls.count()).toBeGreaterThan(0);
            stubs.pump.calls.all().forEach(function(call) {
                expect(call.args[call.args.length - 1]).toBe(callback);
            });
        });

        it('should create a new CleanCSS() instance', function() {
            expect(stubs['clean-css']).toHaveBeenCalledWith({
                advanced: true,
                aggressiveMerging: false,
                benchmark: false,
                compatibility: true,
                debug: false,
                inliner: { foo: 'bar' },
                keepBreaks: true,
                keepSpecialComments: 1,
                mediaMerging: false,
                processImport: true,
                processImportFrom: ['all'],
                rebase: true,
                relativeTo: require('path').dirname(path),
                restructuring: true,
                root: 'my-root/',
                roundingPrecision: -1,
                semanticMerging: false,
                shorthandCompacting: true,
                sourceMap: true,
                sourceMapInlineSources: true,
                target: 'my-target/'
            });
        });

        it('should minify the code', function() {
            expect(cleaner.minify).toHaveBeenCalledWith(code, jasmine.any(Function));
        });

        describe('if minification', function() {
            var callback;

            beforeEach(function() {
                callback = cleaner.minify.calls.mostRecent().args[1];
            });

            describe('fails', function() {
                var error;
                var spy;

                beforeEach(function(done) {
                    error = new Error('It didn\'t work!');
                    spy = jasmine.createSpy('error()');

                    result.on('error', spy);

                    callback(error, null);
                    setTimeout(done, 0);
                });

                it('should fail', function() {
                    expect(failure).toHaveBeenCalledWith(error);
                });
            });

            describe('succeeds', function() {
                var styles;

                beforeEach(function(done) {
                    styles = 'THIS IS THE MINIFIED CSS!';

                    callback(null, { styles: styles });
                    setTimeout(done, 0);
                });

                it('should provide the minified code', function() {
                    expect(success).toHaveBeenCalledWith(styles);
                });
            });
        });

        describe('if there is no cleanCSS config', function() {
            beforeEach(function() {
                stubs['clean-css'].calls.reset();
                file = new MockReadable(code);

                delete config.cleanCSS;

                result = cleanCSSPlugin(path, file, config, callback);
                cleaner = stubs['clean-css'].calls.mostRecent().returnValue;
            });

            it('should create a minimal CleanCSS instance', function() {
                expect(stubs['clean-css']).toHaveBeenCalledWith({
                    relativeTo: require('path').dirname(path)
                });
            });
        });

        describe('if debug mode is enabled', function() {
            beforeEach(function(done) {
                stubs['clean-css'].calls.reset();
                file = new MockReadable(code);

                config.debug = true;

                result = cleanCSSPlugin(path, file, config, callback);
                cleaner = stubs['clean-css'].calls.mostRecent().returnValue;
                streamToPromise(result).finally(done);
            });

            it('should return the file', function() {
                expect(result).toBe(file);
            });

            it('should not minify the code', function() {
                expect(cleaner.minify).not.toHaveBeenCalled();
            });
        });
    });
});
