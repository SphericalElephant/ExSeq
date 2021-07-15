'use strict';
const pull = require('lodash.pull');
const omit = require('lodash.omit');
const pick = require('lodash.pick');
const get = require('lodash.get');

const {alwaysAllowMiddleware} = require('../../../../authorization/middleware');

module.exports = (_enhancer, models, model) => {
  console.log('ENHANCE', model.name);
  return {
    EXSEQ_MODEL_MIXIN: true,
    EXSEQ_MODEL_MIXIN_SEQUELIZE_4: true,
    transaction: model.sequelize.transaction.bind(model.sequelize),
    enhancer: _enhancer,
    getAttributes: function () {
      return this.attributes;
    },
    getUpdateableAttributes: function () {
      return pull(Object.keys(this.attributes), 'id', 'updatedAt', 'createdAt', 'deletedAt')
        .map(attribute => {
          const allowNull = this.attributes[attribute].allowNull;
          return {attribute, allowNull: allowNull === undefined || allowNull === true};
        });
    },
    getReferenceAttributes: function () {
      return pull(Object.keys(this.attributes), 'id', 'updatedAt', 'createdAt', 'deletedAt')
        .filter(attribute => this.attributes[attribute].references);
    },
    getReferences: function () {
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
    filterReferenceAttributesFromModelInstance: function (input) {
      const referenceAttributes = this.getReferenceAttributes();
      return omit(input, referenceAttributes);
    },
    removeIllegalAttributes: function (input) {
      return pick(input, this.getUpdateableAttributes().map(attr => attr.attribute));
    },
    fillMissingUpdateableAttributes: function (association, source, input) {
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
    getAllAssociations: function () {
      const keys = Object.keys(this.associations);
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        this.associations[k].source = this.enhancer.enhance(this.associations[k].source);
        this.associations[k].target = this.enhancer.enhance(this.associations[k].target);
      }
      return this.associations;
    },
    getAssociatedModelNames: function () {
      return Object.keys(this.associations);
    },
    getAssociationByName: function (name) {
      this.associations[name].source = this.enhancer.enhance(this.associations[name].source);
      this.associations[name].target = this.enhancer.enhance(this.associations[name].target);
      return this.associations[name];
    },
    getAssociationTargetByName: function (name) {
      // TODO: SINCE THE OPENAPI GENERATOR CREATES ALL SCHEMAS RECURSIVELY USING THIS METHOD
      // WE MUST ENHANCE THE TARGET MODEL HERE
      return this.enhancer.enhance(this.getAssociationByName(name).target);
    },
    getAssociationByModel: function (associatedModel) {
      const keys = Object.keys(this.associations);
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        if (this.associations[k].target === associatedModel) {
          return this.associations[k];
        }
      }
      throw new Error(`${this.name} has no association to ${associatedModel.name}!`);
    },
    getAssociationCount: async (association, sourceId, query) => {
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
    getModelAssociations: function () {
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
    getModelOpts: function () {
      for (const modelDefinition of models) {
        if (modelDefinition.model === model) {
          return modelDefinition.opts || {};
        }
      }
      return {};
    },
    getParentAuthorizationForModel: function () {
      const authorizationMiddlewaresFound = [];
      for (const modelDefinition of models) {
        const authorizeForChildren = get(modelDefinition, 'opts.authorizeWith.options.authorizeForChildren', undefined);
        if (authorizeForChildren) {
          for (const childModelAuthDefinition of authorizeForChildren) {
            if (childModelAuthDefinition.child === this && childModelAuthDefinition.authorizeForChild) {
              authorizationMiddlewaresFound.push(get(modelDefinition, 'opts.authorizeWith', undefined));
            }
          }
        }
      }
      if (authorizationMiddlewaresFound.length > 1)
        throw new Error(`invalid number of middlewares expected 1, got ${authorizationMiddlewaresFound.length}!`);
      return authorizationMiddlewaresFound[0];
    },
    getAuthorizationMiddleWare: function (associatedModel, type) {
      const isAllowed = ['CREATE', 'READ', 'UPDATE', 'UPDATE_PARTIAL', 'DELETE', 'SEARCH', 'ASSOCIATE', 'OTHER']
        .filter(method => method == type).length === 1;
      const opts = this.getModelOpts();
      if (!isAllowed) {
        throw new Error(`unknown type ${type}`);
      }
      let authorizeWith = opts.authorizeWith;
      if (get(opts, 'authorizeWith.options.useParentForAuthorization', undefined)) {
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
    }
  };
};
