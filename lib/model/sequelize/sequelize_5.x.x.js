'use strict';
const pull = require('lodash.pull');
const omit = require('lodash.omit');

const sequelize4xx = require('./sequelize_4.x.x');

module.exports = (Sequelize, models, model) => {
  sequelize4xx(Sequelize, models, model);
  if (model.EXSEQ_MODEL_MIXIN_SEQUELIZE_5) return;

  // tableAttributes, fieldRawAttributesMap,fieldRawAttributesMap

  Object.defineProperties(model, {
    EXSEQ_MODEL_MIXIN: {
      value: true,
      configurable: true
    },
    EXSEQ_MODEL_MIXIN_SEQUELIZE_5: {
      value: true
    },
    getAttributes: {
      value: function () {
        return this.rawAttributes;
      }
    },
    getUpdateableAttributes: {
      value: function () {
        return pull(Object.keys(this.getAttributes()), 'id', 'updatedAt', 'createdAt', 'deletedAt')
          .map(attribute => {
            const allowNull = this.getAttributes()[attribute].allowNull;
            return {attribute, allowNull: allowNull === undefined || allowNull === true};
          });
      }
    },
    getReferenceAttributes: {
      value: function () {
        return pull(Object.keys(this.getAttributes()), 'id', 'updatedAt', 'createdAt', 'deletedAt')
          .filter(attribute => this.getAttributes()[attribute].references);
      }
    },
    filterReferenceAttributesFromModelInstance: {
      value: function (input) {
        const referenceAttributes = this.getReferenceAttributes();
        return omit(input, referenceAttributes);
      }
    }
  });
};
