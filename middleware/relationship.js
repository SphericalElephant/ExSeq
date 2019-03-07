'use strict';

const AssociationInformation = require('../lib/association-information');

/**
 * A middleware that attaches a function that can be used to obtain association information for any loaded model.
 *
 * The information contains: source model, target model, association type,
 * fk field and for belongstomany associations fk source, fk target and through model.
 */
module.exports = (models, opts) => {
  opts = opts || {};
  const associationInformation = new AssociationInformation(models);
  associationInformation.createAssociationInformation();
  return async function associationMiddleware(req, res, next) {
    req[opts.fieldName || 'associationInformation'] = associationInformation;
    next();
  };
};
