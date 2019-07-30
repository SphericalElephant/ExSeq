'use strict';
const _ = require('lodash');

module.exports = (Sequelize, model) => {
  const Model = Sequelize.Model;
  if (!(model.prototype instanceof Model)) throw new Error(`${model.name} is not a sequelize Model`);
  if (model.EXSEQ_MODEL_MIXIN_SEQUELIZE_4) return;
  Object.defineProperties(model, {
    EXSEQ_MODEL_MIXIN_SEQUELIZE_4: {
      value: true
    },
    transaction: {
      value: model.sequelize.transaction.bind(model.sequelize)
    },
    getAttributes: {
      value: function () {
        return this.attributes;
      },
      configurable: true
    },
    getUpdateableAttributes: {
      value: function () {
        return _.pull(Object.keys(this.attributes), 'id', 'updatedAt', 'createdAt', 'deletedAt')
          .map(attribute => {
            const allowNull = this.attributes[attribute].allowNull;
            return {attribute, allowNull: allowNull === undefined || allowNull === true};
          });
      },
      configurable: true
    },
    getReferenceAttributes: {
      value: function () {
        return _.pull(Object.keys(this.attributes), 'id', 'updatedAt', 'createdAt', 'deletedAt')
          .filter(attribute => this.attributes[attribute].references);
      },
      configurable: true
    },
    getReferences: {
      value: function () {
        return Object.keys(this.attributes)
          .filter(attribute => this.attributes[attribute].references)
          .map(attribute => {
            const field = this.attributes[attribute];
            return {
              model: field.Model,
              key: field.fieldName
            };
          });
      }
    },
    filterReferenceAttributesFromModelInstance: {
      value: function (input) {
        const referenceAttributes = this.getReferenceAttributes();
        return _.omit(input, referenceAttributes);
      },
      configurable: true
    },
    removeIllegalAttributes: {
      value: function (input) {
        return _.pick(input, this.getUpdateableAttributes().map(attr => attr.attribute));
      }
    },
    fillMissingUpdateableAttributes: {
      value: function (association, source, input) {
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
      }
    },
    getAssociatedModelNames: {
      value: function () {
        return Object.keys(this.associations);
      }
    },
    getAssociationByName: {
      value: function (name) {
        return this.associations[name];
      }
    },
    getAssociationByModel: {
      value: function (associatedModel) {
        const keys = Object.keys(this.associations);
        for (let i = 0; i < keys.length; i++) {
          const k = keys[i];
          if (this.associations[k].target === associatedModel) {
            return this.associations[k];
          }
        }
        throw new Error(`${this.name} has no association to ${associatedModel.name}!`);
      }
    },
    getModelAssociations: {
      value: function () {
        const result = [];
        this.getAssociatedModelNames().forEach(associationName => {
          const association = this.getAssociationByName(associationName);
          const target = association.target;
          const source = association.source;
          switch (association.associationType) {
            case 'HasOne':
            case 'HasMany':
              return result.push({
                source,
                target,
                associationType: association.associationType,
                fk: association.foreignKeyField || association.foreignKey,
                as: association.as
              });
            case 'BelongsToMany':
              return result.push({
                source,
                target,
                associationType: association.associationType,
                through: association.throughModel,
                sourceFk: association.foreignKeyField || association.foreignKey,
                targetFk: association.otherKeyField || association.otherKey,
                as: association.as
              });
            case 'BelongsTo':
              return result.push({
                source,
                target,
                associationType: association.associationType,
                fk: association.foreignKeyField || association.foreignKey,
                as: association.as
              });
          }
        });
        return result;
      }
    }
  });
};
