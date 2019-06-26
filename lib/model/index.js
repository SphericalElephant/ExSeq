'use strict';

module.exports = (Sequelize) => {
  return require('./sequelize_4.x.x').bind(null, Sequelize);
};
