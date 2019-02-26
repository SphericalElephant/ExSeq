'use strict';
const _ = require('lodash');

module.exports = (model) => {
  model.getUpdateableAttributes = function () {
    return _.pull(Object.keys(this.attributes), 'id', 'updatedAt', 'createdAt', 'deletedAt')
      .map(attribute => {
        const allowNull = this.attributes[attribute].allowNull;
        return {attribute, allowNull: allowNull === undefined || allowNull === true};
      });
  };

  model.getReferenceAttributes = function () {
    return _.pull(Object.keys(this.attributes), 'id', 'updatedAt', 'createdAt', 'deletedAt')
      .filter(attribute => this.attributes[attribute].references);
  };

  model.getReferences = function () {
    return Object.keys(this.attributes)
      .filter(attribute => this.attributes[attribute].references)
      .map(attribute => {
        const field = this.attributes[attribute];
        return {
          model: field.Model,
          key: field.fieldName
        };
      });
  };

  model.filterReferenceAttributesFromModelInstance = function (input) {
    const referenceAttributes = this.getReferenceAttributes();
    return _.omit(input, referenceAttributes);
  };

  model.removeIllegalAttributes = function (input) {
    return _.pick(input, this.getUpdateableAttributes().map(attr => attr.attribute));
  };

  model.fillMissingUpdateableAttributes = function (association, source, input) {
    const result = this.getUpdateableAttributes().reduce((result, current) => {
      if (input[current.attribute] !== undefined) result[current.attribute] = input[current.attribute];
      else result[current.attribute] = null;
      return result;
    }, {});
    // foreign key is required and not inside the body. will only trigger if this is a relation
    if (association && (association.associationType === 'HasOne' || association.associationType === 'HasMany') &&
      !result[association.foreignKey]) {
      result[association.foreignKey] = source.id;
    }
    return result;
  };

  model.getAssociatedModelNames = function () {
    return _.keys(this.associations);
  };

  model.getAssociationByName = function (name) {
    return this.associations[name];
  };

  model.getAssociationByModel = function (associatedModel) {
    const keys = Object.keys(this.associations);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (this.associations[k].target === associatedModel) {
        return this.associations[k];
      }
    }
    throw new Error(`${this.name} has no association to ${associatedModel.name}!`);
  };

  model.getModelAssociations = function () {
    const result = [];
    this.getAssociatedModelNames().forEach(associationName => {
      const association = this.getAssociationByName(associationName);
      const target = association.target;
      const source = association.source;
      switch (association.associationType) {
        case 'HasOne':
        case 'HasMany':
          result.push({
            source, target, associationType: association.associationType, fk: association.foreignKeyField || association.foreignKey
          });
        case 'BelongsToMany':
        case 'BelongsTo':
          result.push({
            source, target, associationType: association.associationType, fk: association.foreignKeyField || association.foreignKey
          });
      }
    });
    return result;
  };
};
