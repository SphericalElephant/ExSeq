'use strict';

/**
 * A middleware that attaches a function that can be used to obtain association information for any loaded model.
 *
 * The information contains: source model, target model, association type,
 * fk field and for belongstomany associations fk source, fk target and through model.
 */
module.exports = (models) => {
  return async (req, res, next) => {
    const associationInformation = models.reduce((acc, model) => {
      const associations = model.getModelAssociations();
      for (const association of associations) {
        const sourceKey = association.source.name;
        const targetKey = association.target.name;
        if (!acc[sourceKey]) acc[sourceKey] = [];
        if (!acc[targetKey]) acc[targetKey] = [];
        acc[sourceKey].push(association);
        acc[targetKey].push(association);
      }
      return acc;
    }, {});

    associationInformation.getAssociationInformation = function (model) {
      return this[model.name];
    };
    next();
  };
};
