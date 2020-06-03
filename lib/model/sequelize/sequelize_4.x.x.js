'use strict';
const _ = require('lodash');
const {alwaysAllowMiddleware} = require('../../authorization/middleware');

module.exports = (Sequelize, models, model) => {
  const Model = Sequelize.Model;
  if (!(model.prototype instanceof Model)) throw new Error(`${model.name} is not a sequelize Model`);
  if (model.EXSEQ_MODEL_MIXIN_SEQUELIZE_4) return;
  const extension = {
    EXSEQ_MODEL_MIXIN: {
      value: true,
      configurable: true
    },
    EXSEQ_MODEL_MIXIN_SEQUELIZE_4: {
      value: true,
      configurable: true
    },
    transaction: {
      value: model.sequelize.transaction.bind(model.sequelize),
      configurable: true
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
      },
      configurable: true
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
      },
      configurable: true
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
      },
      configurable: true
    },
    getAssociatedModelNames: {
      value: function () {
        return Object.keys(this.associations);
      },
      configurable: true
    },
    getAssociationByName: {
      value: function (name) {
        return this.associations[name];
      },
      configurable: true
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
      },
      configurable: true
    },
    getAssociationCount: {
      value: async (association, sourceId, query) => {
        const where = query ? query.where : null;
        if (association.associationType === 'HasMany') {
          return await association.target.count({where});
        } else if (association.associationType === 'BelongsToMany') {
          const includeOpts = {model: association.target, where};
          if (association.options.as) {
            includeOpts.as = association.options.as.plural || association.options.as;
          }
          return await association.source.count({
            where: {
              id: sourceId
            },
            include: [includeOpts]
          });
        } else {
          throw new Error('Unsupported!');
        }
      },
      configurable: true
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
      },
      configurable: true
    },
    getModelOpts: {
      value: function () {
        for (const modelDefinition of models) {
          if (modelDefinition.model === model) {
            return modelDefinition.opts;
          }
        }
        return {};
      },
      configurable: true
    },
    getParentAuthorizationForModel: {
      value: function () {
        const authorizationMiddlewaresFound = [];
        for (const modelDefinition of models) {
          const authorizeForChildren = _.get(modelDefinition, 'opts.authorizeWith.options.authorizeForChildren', undefined);
          if (authorizeForChildren) {
            for (const childModelAuthDefinition of authorizeForChildren) {
              if (childModelAuthDefinition.child === this && childModelAuthDefinition.authorizeForChild) {
                authorizationMiddlewaresFound.push(_.get(modelDefinition, 'opts.authorizeWith', undefined));
              }
            }
          }
        }
        if (authorizationMiddlewaresFound.length > 1)
          throw new Error(`invalid number of middlewares expected 1, got ${authorizationMiddlewaresFound.length}!`);
        return authorizationMiddlewaresFound[0];
      },
      configurable: true
    },
    getAuthorizationMiddleWare: {
      value: function (associatedModel, type) {
        const isAllowed = ['CREATE', 'READ', 'UPDATE', 'UPDATE_PARTIAL', 'DELETE', 'SEARCH', 'ASSOCIATE', 'OTHER']
          .filter(method => method == type).length === 1;
        const opts = this.getModelOpts();
        if (!isAllowed) {
          throw new Error(`unknown type ${type}`);
        }
        let authorizeWith = opts.authorizeWith;
        if (_.get(opts, 'authorizeWith.options.useParentForAuthorization', undefined)) {
          if (!associatedModel) throw new Error(`${this.name} specified to useParentForAuthorization but the associatedModel is null!`);
          const association = this.getAssociationByModel(associatedModel);
          if (association.associationType !== 'BelongsTo' && association.associationType !== 'BelongsToMany')
            throw new Error(
              `${this.name} has no BelongsTo / BelongsToMany association to ${associatedModel.name}, useParentForAuthorization is invalid!`
            );
          const parentOpts = associatedModel.getModelOpts();
          authorizeWith = parentOpts.authorizeWith;
        }
        // use parent model authorization for root routes of another model
        const authorizationFromParent = this.getParentAuthorizationForModel();
        if (authorizationFromParent) authorizeWith = authorizationFromParent;

        return authorizeWith && authorizeWith.rules ?
          (authorizeWith.rules[type] || authorizeWith.rules['OTHER'] || alwaysAllowMiddleware) :
          alwaysAllowMiddleware;
      },
      configurable: true
    }
  };

  const removeModelExtension = {
    removeModelExtension: {
      value: function () {
        for (const prop in extension) {
          delete this[prop];
        }
      },
      configurable: true
    }
  };

  Object.defineProperties(model, {
    ...extension,
    ...removeModelExtension
  });
};
