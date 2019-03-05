'use strict';

Array.prototype.flattenDeep = function () {
  return this.reduce((acc, val) => Array.isArray(val) ? acc.concat(val.flattenDeep()) : acc.concat(val), []);
};
