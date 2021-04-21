'use strict';
const _ = require('lodash');

module.exports = (models, model) => {
  return {
    EXSEQ_MODEL_MIXIN: true,
    EXSEQ_MODEL_MIXIN_SEQUELIZE_5: true,
    getAttributes: function () {
      return this.rawAttributes;
    },
    getUpdateableAttributes: function () {
      return _.pull(Object.keys(this.getAttributes()), 'id', 'updatedAt', 'createdAt', 'deletedAt')
        .map(attribute => {
          const allowNull = this.getAttributes()[attribute].allowNull;
          return {attribute, allowNull: allowNull === undefined || allowNull === true};
        });
    },
    getReferenceAttributes: function () {
      return _.pull(Object.keys(this.getAttributes()), 'id', 'updatedAt', 'createdAt', 'deletedAt')
        .filter(attribute => this.getAttributes()[attribute].references);
    },
    filterReferenceAttributesFromModelInstance: function (input) {
      const referenceAttributes = this.getReferenceAttributes();
      return _.omit(input, referenceAttributes);
    }
  };
};
