'use strict';
require('./array');
class AssociationInformation {
  constructor(models) {
    if (!models) throw new Error('no models provided.');
    this.models = models;
    this.associationInformation = undefined;
  }
  createAssociationInformation() {
    this.associationInformation = this.models.reduce((acc, model) => {
      if (!this.isValidModel(model))
        throw new Error(`invalid model ${model.name}`);
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
  }
  getAssociationInformation(input) {
    if (!this.associationInformation) throw new Error('association information not initialized!');
    if (typeof input == 'string') { // FK lookup
      const flattenedAssocInformation = Array.from(new Set(Object.values(this.associationInformation).flattenDeep()));
      const res = flattenedAssocInformation.filter(assocInfo => {
        return assocInfo.fk === input || assocInfo.sourceFk === input || assocInfo.targetFk === input;
      });
      return res;
    } else { // model lookup
      if (!this.isValidModel(input))
        throw new Error(`invalid model ${input.name}`);
      return this.associationInformation[input.name];
    }
  }
  isValidModel(model) {
    console.log('WAT', model.getModelAssociations);
    return model.getModelAssociations && (model.getModelAssociations instanceof Function);
  }
}

module.exports = AssociationInformation;
