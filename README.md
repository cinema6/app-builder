rc-app-builder
===============

Install
-------
```bash
$> npm install rc-app-builder --registry "http://deployer1:4873/"
```

Usage
-----
### AppBuilder(*userAgent*)
* Constructor Parameters
    * (`Object`) **config**: Configuration options:
        * (`String`) **config.baseDir**: The folder from which relative paths in the entry file should be resolved. Specifying this is only necessary if a `stream.Readable()` is passed to `AppBuilder.prototype.build()`.
        * (`String`) **config.baseURL**: If the entry HTML file contains a `<base>` tag, its `href` will be modified to resolve to the `baseURL`.
        * (`Boolean`) **config.debug**: If `true` will cause certain plugins to behave differently. For example, the UglifyJS plugin will do nothing.
* Properties
    * (`Object`) **config**: The `config` passed to the constructor.
    * (`Object`) **plugins**: The build plugins that will be used:
        * (`Array` of `String`s): **js**: Paths to plugin modules for transforming JavaScript.
        * (`Array` of `String`s): **css**: Paths to plugin modules for transforming CSS.
* Methods
    * **build(entry)**: Builds an app using the configured plugins and inlines all JS and CSS resource into the result.
        * Parameters:
            * (`String` or `stream.Readable`): Either a path to an HTML file, or a `stream.Readable` representing an HTML document.
        * Returns:
            * (`stream.Readable`): A stream representing the compiled app HTML file.

### Plugins
#### rc-app-builder/plugins/js/browserify
**Included by default**

This JS plugin will compile all JavaScript assets with [browserify](https://github.com/substack/node-browserify).

##### Configuration Options
* (`Object`) **config.browserify.options**: Options to pass to the [`browserify()` function](https://github.com/substack/node-browserify#browserifyfiles--opts).
* (`Array` of `Array`s) **config.browserify.plugins**: Each `Array` should contain two elements:
    * (`String`): **0**: The name of a browserify plugin module.
    * (`Object`) *[optional]* **1**: A configuration `Object` for the plugin.
* (`Array` of `Array`s) **config.browserify.transforms**: Each `Array` should contain two elements:
    * (`String`): **0**: The name of a browserify transform module.
    * (`Object`) *[optional]* **1**: A configuration `Object` for the transform.

##### Example
```javascript
var fs = require('fs');
var AppBuilder = require('rc-app-builder');
var builder = new AppBuilder({
    debug: true,

    browserify: {
        options: {
            insertGlobals: true
        },

        transforms: [
            ['babelify', {
                presets: ['es2015', 'react']
            }],
            ['uglifyify']
        ]
    }
});

builder.build('./my-app.html').pipe(fs.createWriteStream('./my-app--built.html'));
```

#### rc-app-builder/plugins/js/uglify
**Included by default**

This JS plugin will compress all JavaScript assets with [UglifyJS](https://github.com/mishoo/UglifyJS2).

##### Configuration Options
* (`Object`) **config.uglify**: Options to pass to the [`UglifyJS.minify()` method](https://github.com/mishoo/UglifyJS2#the-simple-way).
* (`Boolean`) **config.debug**: If `true`, this plugin will do nothing.

##### Example
```javascript
var fs = require('fs');
var AppBuilder = require('rc-app-builder');
var builder = new AppBuilder({
    debug: false,

    uglify: {
        output: {
            comments: true,
            semicolons: false
        },
        compress: {
            unsafe: true,
            warnings: false
        }
    }
});

builder.build('./my-app.html').pipe(fs.createWriteStream('./my-app--built.html'));
```

#### rc-app-builder/plugins/css/clean
**Included by default**

This JS plugin will compress all JavaScript assets with [UglifyJS](https://github.com/mishoo/UglifyJS2).

##### Configuration Options
* (`Object`) **config.cleanCSS**: Options to pass to the [`CleanCSS()` constructor](https://github.com/jakubpawlowicz/clean-css/tree/3.4#how-to-use-clean-css-api).
* (`Boolean`) **config.debug**: If `true`, this plugin will do nothing.

##### Example
```javascript
var fs = require('fs');
var AppBuilder = require('rc-app-builder');
var builder = new AppBuilder({
    debug: false,

    cleanCSS: {
        aggressiveMerging: false,
        keepSpecialComments: true
    }
});

builder.build('./my-app.html').pipe(fs.createWriteStream('./my-app--built.html'));
```

### Authoring Plugins
AppBuilder plugins are CommonJS modules that export `Function`s. The `Function` accepts a number of parameters and is expected to return a stream that emits data (like a `stream.Readable`, `stream.Duplex` or `stream.Transform`.)

* Passed Parameters:
    * (`String`) **path**: The absolute path of the file to be transformed.
    * (`stream.Readable`) **file**: A stream representing the file. If your plugin is not first in the `builder.plugins.js`/`builder.plugins.css` `Array`, this will be the stream returned by the plugin preceding yours.
    * (`Object`) **config**: A deep copy of the `AppBuilder` instance's `config`.
    * (`Function`) **callback**: A `Function` to (optionally) call with an `Error` when something goes wrong.

Your plugin can then be registered by adding it to the proper `plugins` `Array`:

```javascript
var AppBuilder = require('rc-app-builder');
var builder = new AppBuilder();

builder.plugins.js.push(
    require.resolve('./path/to/my/plugin'),
    require.resolve('module-from-npm')
);
```