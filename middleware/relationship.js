'use strict';

/**
 * A middleware that attaches all models which have been referenced by a foreignkey inside req.body in the following manner:
 *
 * [{model: model, key: foreignKey}] - key and model can then be used to check if the caller has access to the entity.
 */

// TODO: we need to prevent POST / PUT and PATCH requests that attempt to change the FK of either the source
// (HasOne or HasMany) or the target (BelongsTo or BelongsToMany). currently callers are able to
// modify the owning entity by passing the FK of the owning entity in the body. This makes it hard to implement
// access restrictions because the middleware would have to check the path as well as the body for information
// all the time. Please also make sure to document the behavior in the readme once this todo has been done.
//
// Create a middleware that attaches a list: [{model: MODEL, primaryKey: FK},...], that contains the FK and the
// model of the relation to be altered, so that the authorization middleware is easier to write.
module.exports = (model) => {
  return async (req, res, next) => {
    const result = [];
    model.getAssociatedModelNames().forEach(associationName => {
      const association = model.getAssociationByName(associationName);
      const target = association.target;
      const source = association.source;
      //console.log('INSPECT',require('util').inspect(association,{customInspect:false}))
      switch (association.associationType) {
        case 'HasOne':
        case 'HasMany':
          result.push({
            source, target, associationType: association.associationType, fk: association.foreignKeyField
          });
        case 'BelongsToMany':
        case 'BelongsTo':
          result.push({
            source, target, associationType: association.associationType, fk: association.foreignKeyField
          });
      }
    });
    req.__exseqRelatedModels = result;
    next();
  };
};
