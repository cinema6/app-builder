var proxyquire = require('proxyquire').noPreserveCache();

describe('rc-app-builder', function() {
    'use strict';

    var fs;
    var Bluebird;
    var MockWritable;
    var MockReadable;
    var assign;

    var AppBuilder;

    var stubs;

    var success, failure;

    function run(file, args, outStream) {
        var stdinDescriptor = Object.getOwnPropertyDescriptor(process, 'stdin');
        var stdoutDescriptor = Object.getOwnPropertyDescriptor(process, 'stdout');
        var argvDescriptor = Object.getOwnPropertyDescriptor(process, 'argv');
        var exitDescriptor = Object.getOwnPropertyDescriptor(process, 'exit');
        var cwdDescriptor = Object.getOwnPropertyDescriptor(process, 'cwd');

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
                    value: [process.execPath, require.resolve('../../bin/rc-app-builder')].concat(args),
                    configurable: true,
                    enumerable: true
                },
                exit: {
                    value: jasmine.createSpy('process.exit()').and.callFake(function(code) {
                        if (code > 0) {
                            return reject(new Error('Exited with code: ' + code));
                        }

                        return resolve(process.stdout.data);
                    }),
                    configurable: true,
                    enumerable: true
                },
                cwd: {
                    value: jasmine.createSpy('process.cwd()').and.returnValue(__dirname),
                    configurable: true,
                    enumerable: true
                }
            });

            delete require.cache[require.resolve('commander')];
            proxyquire('../../bin/rc-app-builder', stubs);

            (outStream || process.stdout).on('removeListener', function(event) {
                if (event === 'finish') { resolve(process.stdout.data); }
            });
            process.stdout.once('error', function(error) {
                reject(error);
            });
        }).finally(function cleanup() {
            Object.defineProperties(process, {
                stdin: stdinDescriptor,
                stdout: stdoutDescriptor,
                argv: argvDescriptor,
                exit: exitDescriptor,
                cwd: cwdDescriptor
            });
        });
    }

    beforeEach(function() {
        fs = require('fs-extra');
        Bluebird = require('bluebird');
        MockWritable = require('../helpers/MockWritable');
        MockReadable = require('../helpers/MockReadable');
        assign = require('lodash/object/assign');

        success = jasmine.createSpy('success()');
        failure = jasmine.createSpy('failure()');

        AppBuilder = jasmine.createSpy('AppBuilder()').and.callFake(function(config) {
            var AppBuilder = require('../../lib/AppBuilder');
            var builder = new AppBuilder(config);

            spyOn(builder, 'build').and.returnValue(new MockReadable('THIS IS MY BUILT APP!'));

            return builder;
        });

        stubs = {
            '../lib/AppBuilder': AppBuilder,

            '@noCallThru': true
        };
    });

    describe('--version', function() {
        beforeEach(function(done) {
            run(new MockReadable(''), ['--version']).then(success, failure).finally(done);
        });

        it('should return the version from package.json', function() {
            expect(success).toHaveBeenCalledWith(require('../../package.json').version + '\n');
        });
    });

    describe('with stdin input', function() {
        var file;
        var builder;

        beforeEach(function(done) {
            file = new MockReadable(fs.readFileSync(require.resolve('../helpers/assets/index.html')).toString());

            run(file, []).then(success, failure).finally(done);
            builder = AppBuilder.calls.mostRecent().returnValue;
        });

        it('should create an AppBuilder()', function() {
            expect(AppBuilder).toHaveBeenCalledWith({});
        });

        it('should build the app with what is piped to stdin', function() {
            expect(builder.build).toHaveBeenCalledWith(file);
        });

        it('should pipe() the response to stdout', function() {
            expect(success).toHaveBeenCalledWith('THIS IS MY BUILT APP!');
        });
    });

    describe('with a config file', function() {
        var file;
        var builder;

        beforeEach(function(done) {
            file = new MockReadable(fs.readFileSync(require.resolve('../helpers/assets/index.html')).toString());

            run(file, ['--config', '../helpers/assets/build.json']).then(success, failure).finally(done);
            builder = AppBuilder.calls.mostRecent().returnValue;
        });

        it('should create the AppBuilder() with the contents of the JSON file', function() {
            expect(AppBuilder).toHaveBeenCalledWith(fs.readJSONSync(require.resolve('../helpers/assets/build.json')));
        });

        it('should build the app with what is piped to stdin', function() {
            expect(builder.build).toHaveBeenCalledWith(file);
        });

        it('should pipe() the response to stdout', function() {
            expect(success).toHaveBeenCalledWith('THIS IS MY BUILT APP!');
        });

        describe('and a baseDir and baseURL', function() {
            beforeEach(function(done) {
                AppBuilder.calls.reset();

                file = new MockReadable(fs.readFileSync(require.resolve('../helpers/assets/index.html')).toString());

                run(file, ['--config', '../helpers/assets/build.json', '--base-dir', '../helpers/assets', '--base-url', 'http://www.reelcontent.com/']).then(success, failure).finally(done);
                builder = AppBuilder.calls.mostRecent().returnValue;
            });

            it('should create the AppBuilder with those properties', function() {
                expect(AppBuilder).toHaveBeenCalledWith(assign(fs.readJSONSync(require.resolve('../helpers/assets/build.json')), {
                    baseDir: require('path').resolve(__dirname, '../helpers/assets'),
                    baseURL: 'http://www.reelcontent.com/'
                }));
            });

            it('should build the app with what is piped to stdin', function() {
                expect(builder.build).toHaveBeenCalledWith(file);
            });

            it('should pipe() the response to stdout', function() {
                expect(success).toHaveBeenCalledWith('THIS IS MY BUILT APP!');
            });
        });
    });

    describe('with the debug flag', function() {
        var file;
        var builder;

        beforeEach(function(done) {
            AppBuilder.calls.reset();

            file = new MockReadable(fs.readFileSync(require.resolve('../helpers/assets/index.html')).toString());

            run(file, ['--debug']).then(success, failure).finally(done);
            builder = AppBuilder.calls.mostRecent().returnValue;
        });

        it('should create the AppBuilder with debug set to true', function() {
            expect(AppBuilder).toHaveBeenCalledWith({ debug: true });
        });

        it('should build the app with what is piped to stdin', function() {
            expect(builder.build).toHaveBeenCalledWith(file);
        });

        it('should pipe() the response to stdout', function() {
            expect(success).toHaveBeenCalledWith('THIS IS MY BUILT APP!');
        });
    });

    describe('with an entry file', function() {
        var builder;

        beforeEach(function(done) {
            run(new MockReadable(''), ['--entry', '../helpers/assets/index.html']).then(success, failure).finally(done);
            builder = AppBuilder.calls.mostRecent().returnValue;
        });

        it('should build the app with the path to the file', function() {
            expect(builder.build).toHaveBeenCalledWith(require.resolve('../helpers/assets/index.html'));
        });

        it('should pipe() the response to stdout', function() {
            expect(success).toHaveBeenCalledWith('THIS IS MY BUILT APP!');
        });
    });

    describe('with an output file', function() {
        var builder;
        var file;
        var outfile;

        beforeEach(function(done) {
            file = new MockReadable(fs.readFileSync(require.resolve('../helpers/assets/index.html')).toString());
            outfile = new MockWritable();

            spyOn(fs, 'createWriteStream').and.returnValue(outfile);

            run(file, ['--output', '../../build/index.html'], outfile).then(success, failure).finally(done);
            builder = AppBuilder.calls.mostRecent().returnValue;
        });

        it('should create a write stream', function() {
            expect(fs.createWriteStream).toHaveBeenCalledWith(require('path').resolve(__dirname, '../../build/index.html'));
        });

        it('should build the app with what is piped to stdin', function() {
            expect(builder.build).toHaveBeenCalledWith(file);
        });

        it('should pipe() the response to the file', function() {
            expect(outfile.data).toBe('THIS IS MY BUILT APP!');
        });
    });
});
