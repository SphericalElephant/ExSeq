'use strict';
const _ = require('lodash');
const sequelize5xx = require('./sequelize_5.x.x');

module.exports = (Sequelize, models, model) => {
  sequelize5xx(Sequelize, models, model);
  if (model.EXSEQ_MODEL_MIXIN_SEQUELIZE_6) return;
  Object.defineProperties(model, {
    EXSEQ_MODEL_MIXIN: {
      value: true,
      configurable: true
    },
    EXSEQ_MODEL_MIXIN_SEQUELIZE_6: {
      value: true
    }
  });
};
