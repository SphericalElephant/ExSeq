'use strict';

module.exports = (req, res, next, status, result, message) => {
  res.__payload = {status, result, message};
  next();
  return Promise.resolve();
};
