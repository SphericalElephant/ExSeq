'use strict';

class AssociationInformation {
  constructor(models) {
    if (!models) throw new Error('no models provided.');
    this.models = models;
    this.associationInformation = undefined;
  }
  createAssociationInformation() {
    this.associationInformation = this.models.reduce((acc, model) => {
      if (!this.isValidModel(model))
        throw new Error(`invalid model ${model}`);
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
  getAssociationInformation(model) {
    if (!this.associationInformation) throw new Error('association information not initialized!');
    if (!this.isValidModel(model))
      throw new Error(`invalid model ${model}`);
    return this.associationInformation[model.name];
  }
  isValidModel(model) {
    return !model.getModelAssociations || (model.getModelAssociations instanceof Function);
  }
}

module.exports = AssociationInformation;
