'use strict';
const _ = require('lodash');
const createError = require('../error/create-error');

const _formatValidationError = (err) => {
  return err.errors.map(error => {
    return _.pick(error, ['type', 'path', 'value']);
  });
};

module.exports = (ERRORS) => (next, err) => {
  if (ERRORS.ValidationError(err))
    return next(createError(400, _formatValidationError(err)));
  else if (err.isCreatedError)
    return next(err);
  else
    return next(createError(500, err));
};
