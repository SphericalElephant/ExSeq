'use strict';

/**
 * A middleware that attaches all models which have been referenced by a foreignkey inside req.body in the following manner:
 *
 * [{model: model, pk: foreignKey}] - pk and model can then be used to check if the caller has access to the entity.
 */
module.exports = async (req, res, next) => {

};
