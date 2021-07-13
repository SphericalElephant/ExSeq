'use strict';
const createError = require('../error/create-error');

const _formatValidationError = (err) => {
  return err.errors.map(error => {
    const {type, path, value} = error;
    return {type, path, value};
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
