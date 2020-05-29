'use strict';

module.exports = (dataMapper) => {
  // TODO: this seems ugly and error prone
  const major = dataMapper.version.split('\.')[0];
  switch (major) {
    case '4':
      return require('./sequelize/sequelize_4.x.x').bind(null, dataMapper);
    case '5':
      return require('./sequelize/sequelize_5.x.x').bind(null, dataMapper);
    case '6':
      // using the sequelize 5 wrapper seems to work (for now!)
      return require('./sequelize/sequelize_5.x.x').bind(null, dataMapper);
    default:
      throw new Error(`unsupported sequelize version ${dataMapper.version}`);
  }
};
