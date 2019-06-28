'use strict';

const sequelizeVersion = 5;

// eslint-disable-next-line max-len
const Sequelize = sequelizeVersion === 5 ? require('sequelize5') : (sequelizeVersion === 4 ? require('sequelize4') : new Error(`unsupported sequelize verion ${sequelizeVersion}`));

if (Sequelize instanceof Error) {
  throw Sequelize;
}

const sequelize = new Sequelize('', '', '', {storage: ':memory:', dialect: 'sqlite', logging: false});

module.exports = {
  reset: sequelize.drop.bind(sequelize),
  init: sequelize.sync.bind(sequelize),
  Sequelize,
  sequelize
};
