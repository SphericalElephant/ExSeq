'use strict';

Object.defineProperty(Array.prototype, 'flattenDeep', {
  value: function () {
    return this.reduce((acc, val) => Array.isArray(val) ? acc.concat(val.flattenDeep()) : acc.concat(val), []);
  },
  writable: false,
  configurable: false
});
