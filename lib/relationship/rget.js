'use strict';

const {createError} = require('../error');

module.exports = (queryBuilder, source, association) => {
  return (postProcess) => {
    return async (req, res, next) => {
      try {
        const sourceInstance = await source.findByPk(req.params.id);
        if (!sourceInstance) throw createError(404, 'source not found.');
        const query = queryBuilder.create(req.query).prepare().query;
        const targetInstance = await sourceInstance[association.accessors.get](query);
        if (!targetInstance) throw createError(404, 'target not found.');
        return res.replyHandler(next, 200, postProcess(req, targetInstance));
      } catch (err) {
        return res.errorHandler(next, err);
      } finally {
        queryBuilder.reset();
      }
    };
  };
};
