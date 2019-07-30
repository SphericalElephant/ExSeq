'use strict';
const _ = require('lodash');
const sequelize4xx = require('./sequelize_4.x.x');

module.exports = (Sequelize, model) => {
  sequelize4xx(Sequelize, model);
  if (model.EXSEQ_MODEL_MIXIN_SEQUELIZE_5) return;

  // tableAttributes, fieldRawAttributesMap,fieldRawAttributesMap

  Object.defineProperties(model, {
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
        return _.pull(Object.keys(this.getAttributes()), 'id', 'updatedAt', 'createdAt', 'deletedAt')
          .map(attribute => {
            const allowNull = this.getAttributes()[attribute].allowNull;
            return {attribute, allowNull: allowNull === undefined || allowNull === true};
          });
      }
    },
    getReferenceAttributes: {
      value: function () {
        return _.pull(Object.keys(this.getAttributes()), 'id', 'updatedAt', 'createdAt', 'deletedAt')
          .filter(attribute => this.getAttributes()[attribute].references);
      }
    },
    filterReferenceAttributesFromModelInstance: {
      value: function (input) {
        const referenceAttributes = this.getReferenceAttributes();
        return _.omit(input, referenceAttributes);
      }
    }
  });
};
