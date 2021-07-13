'use strict';

const pull = require('lodash.pull');
const omit = require('lodash.omit');

module.exports = (_enhancer, _models, _model) => {
  return {
    EXSEQ_MODEL_MIXIN: true,
    EXSEQ_MODEL_MIXIN_SEQUELIZE_5: true,
    getAttributes: function () {
      return this.rawAttributes;
    },
    getUpdateableAttributes: function () {
      return pull(Object.keys(this.getAttributes()), 'id', 'updatedAt', 'createdAt', 'deletedAt')
        .map(attribute => {
          const allowNull = this.getAttributes()[attribute].allowNull;
          return {attribute, allowNull: allowNull === undefined || allowNull === true};
        });
    },
    getReferenceAttributes: function () {
      return pull(Object.keys(this.getAttributes()), 'id', 'updatedAt', 'createdAt', 'deletedAt')
        .filter(attribute => this.getAttributes()[attribute].references);
    },
    filterReferenceAttributesFromModelInstance: function (input) {
      const referenceAttributes = this.getReferenceAttributes();
      return omit(input, referenceAttributes);
    }
  };
};
