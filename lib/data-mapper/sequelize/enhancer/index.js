'use strict';

const {SequelizeEnhancer} = require('./enhancer');

module.exports = (dataMapper) => {
  const majorVersion = dataMapper.version.split('\.')[0];

  return function (models, model) {
    const enhancer = new SequelizeEnhancer(dataMapper, majorVersion, models);
    return enhancer.enhance(model);
  };
};
