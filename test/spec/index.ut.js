'use strict';

describe('index', function() {
    it('should export the AppBuilder constructor', function() {
        expect(require('../../index')).toBe(require('../../lib/AppBuilder'));
    });
});
