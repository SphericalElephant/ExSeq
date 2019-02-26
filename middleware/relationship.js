'use strict';

/**
 * A middleware that attaches all models which have been referenced by a foreignkey inside req.body in the following manner:
 *
 * [{model: model, key: foreignKey}] - key and model can then be used to check if the caller has access to the entity.
 */
module.exports = (model) => {
  return async (req, res, next) => {
    req.__exseqRelatedModels = model.getModelAssociations();
    next();
  };
};
