'use strict';

module.exports = {
  ValidationError: (err) => {
    return err.name === 'SequelizeValidationError';
  }
};
