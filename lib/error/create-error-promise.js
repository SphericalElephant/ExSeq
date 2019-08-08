'use strict';

const createError = require('./create-error');

module.exports = (status, errInput) => {
  return Promise.reject(createError(status, errInput));
};
