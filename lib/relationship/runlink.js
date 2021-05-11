'use strict';
const createErrorPromise = require('../error/create-error-promise.js');

module.exports = (source, association) => {
  return (req, res, next) => {
    source.findByPk(req.params.id).then(sourceInstance => {
      if (!sourceInstance) return createErrorPromise(404, 'source not found.');
      return sourceInstance[association.accessors.set](null).then(_ => {
        return res.replyHandler(next, 204);
      });
    }).catch(err => {
      return res.errorHandler(next, err);
    });
  };
};
