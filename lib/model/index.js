'use strict';

module.exports = (Sequelize) => {
  const major = Sequelize.version.split('\.')[0];
  switch (major) {
    case '4':
      return require('./sequelize_4.x.x').bind(null, Sequelize);
    case '5':
      return require('./sequelize_5.x.x').bind(null, Sequelize);
    default:
      throw new Error(`unsupported sequelize verion ${Sequelize.version}`);
  }
};
