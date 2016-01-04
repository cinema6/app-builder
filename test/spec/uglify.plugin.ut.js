'use strict';

var proxyquire = require('proxyquire');

describe('uglifyPlugin(path, file, config, callback)', function() {
    var uglifyPlugin;
    var MockReadable;
    var fs;
    var streamToPromise;
    var UglifyJS;

    var stubs;

    beforeEach(function() {
        stubs = {
            'pump': jasmine.createSpy('pump()').and.callFake(require('pump')),

            '@noCallThru': true
        };

        uglifyPlugin = proxyquire('../../plugins/js/uglify', stubs);
        MockReadable = require('../helpers/MockReadable');
        fs = require('fs-extra');
        streamToPromise = require('stream-to-promise');
        UglifyJS = require('uglify-js');
    });

    it('should exist', function() {
        expect(uglifyPlugin).toEqual(jasmine.any(Function));
        expect(uglifyPlugin.name).toBe('uglifyPlugin');
    });

    describe('when called', function() {
        var code;
        var path, file, config, callback;
        var success, failure;
        var result;

        beforeEach(function(done) {
            spyOn(UglifyJS, 'minify').and.returnValue({
                code: 'THIS IS THE MINIFIED CODE!'
            });

            path = require.resolve('../helpers/assets/js/main.js');
            code = fs.readFileSync(path).toString();

            file = new MockReadable(code);
            config = {
                debug: false,
                baseDir: require('path').resolve(__dirname, '../helpers/assets'),

                /* jshint camelcase: false */
                uglify: {
                    warnings: true,
                    fromString: false,
                    mangle: true,
                    output: {
                        indent_start  : 0,
                        indent_level  : 4,
                        quote_keys    : false,
                        space_colon   : true,
                        ascii_only    : false,
                        inline_script : false,
                        width         : 80,
                        max_line_len  : 32000,
                        ie_proof      : true,
                        beautify      : false,
                        source_map    : null,
                        bracketize    : false,
                        comments      : false,
                        semicolons    : true
                    },
                    compress: {
                        sequences     : true,
                        properties    : true,
                        dead_code     : true,
                        drop_debugger : true,
                        unsafe        : false,
                        conditionals  : true,
                        comparisons   : true,
                        evaluate      : true,
                        booleans      : true,
                        loops         : true,
                        unused        : true,
                        hoist_funs    : true,
                        hoist_vars    : false,
                        if_return     : true,
                        join_vars     : true,
                        cascade       : true,
                        side_effects  : true,
                        warnings      : true,
                        global_defs   : {}
                    }
                }
                /* jshint camelcase: true */
            };
            callback = jasmine.createSpy('callback()');

            success = jasmine.createSpy('success()');
            failure = jasmine.createSpy('failure()');

            result = uglifyPlugin(path, file, config, callback);
            streamToPromise(result).then(function(buffer) { return buffer.toString(); }).then(success, failure).finally(done);
        });

        it('should pass the callback() to pump()', function() {
            expect(stubs.pump.calls.count()).toBeGreaterThan(0);
            stubs.pump.calls.all().forEach(function(call) {
                expect(call.args[call.args.length - 1]).toBe(callback);
            });
        });

        it('should minify the code', function() {
            expect(UglifyJS.minify).toHaveBeenCalledWith(code, {
                /* jshint camelcase: false */
                warnings: true,
                fromString: true,
                mangle: true,
                output: {
                    indent_start  : 0,
                    indent_level  : 4,
                    quote_keys    : false,
                    space_colon   : true,
                    ascii_only    : false,
                    inline_script : false,
                    width         : 80,
                    max_line_len  : 32000,
                    ie_proof      : true,
                    beautify      : false,
                    source_map    : null,
                    bracketize    : false,
                    comments      : false,
                    semicolons    : true
                },
                compress: {
                    sequences     : true,
                    properties    : true,
                    dead_code     : true,
                    drop_debugger : true,
                    unsafe        : false,
                    conditionals  : true,
                    comparisons   : true,
                    evaluate      : true,
                    booleans      : true,
                    loops         : true,
                    unused        : true,
                    hoist_funs    : true,
                    hoist_vars    : false,
                    if_return     : true,
                    join_vars     : true,
                    cascade       : true,
                    side_effects  : true,
                    warnings      : true,
                    global_defs   : {}
                }
                /* jshint camelcase: true */
            });
        });

        it('should pipe out the minified code', function() {
            expect(success).toHaveBeenCalledWith(UglifyJS.minify.calls.mostRecent().returnValue.code);
        });

        describe('if no uglify options exist', function() {
            beforeEach(function(done) {
                success.calls.reset();
                failure.calls.reset();
                delete config.uglify;

                UglifyJS.minify.calls.reset();

                file = new MockReadable(code);

                result = uglifyPlugin(path, file, config, callback);
                streamToPromise(result).then(function(buffer) { return buffer.toString(); }).then(success, failure).finally(done);
            });

            it('should minify the code', function() {
                expect(UglifyJS.minify).toHaveBeenCalledWith(code, {
                    fromString: true
                });
            });

            it('should pipe out the minified code', function() {
                expect(success).toHaveBeenCalledWith(UglifyJS.minify.calls.mostRecent().returnValue.code);
            });
        });

        describe('if debug mode is on', function() {
            beforeEach(function(done) {
                config.debug = true;

                UglifyJS.minify.calls.reset();

                file = new MockReadable(code);

                result = uglifyPlugin(path, file, config, callback);
                streamToPromise(result).finally(done);
            });

            it('should not minify the code', function() {
                expect(UglifyJS.minify).not.toHaveBeenCalled();
            });

            it('should return the file', function() {
                expect(result).toBe(file);
            });
        });
    });
});
