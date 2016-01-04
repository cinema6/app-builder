'use strict';

var Writable = require('stream').Writable;
var inherits = require('util').inherits;

function MockWritable() {
    this.data = '';

    Writable.apply(this, arguments);
}
inherits(MockWritable, Writable);

MockWritable.prototype._write = function _write(chunk, encoding, done) {
    this.data += chunk.toString();
    done();
};

module.exports = MockWritable;
