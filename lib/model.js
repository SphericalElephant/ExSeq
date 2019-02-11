'use strict';
const _ = require('lodash');

module.exports = (model) => {
  //console.log(model.name,model.prototype)
  model.exseqGetUpdateableAttributes = () => {
    return _.pull(_.keys(this.attributes), 'id', 'updatedAt', 'createdAt', 'deletedAt')
      .map(attribute => {
        const allowNull = this.attributes[attribute].allowNull;
        return {attribute, allowNull: allowNull === undefined || allowNull === true};
      });
  };
};
