'use strict';

const Sequelize = require('sequelize');

let sequelize = new Sequelize('', '', '', {storage: './test.sqlite', dialect: 'sqlite', logging: false});

module.exports = {
  reset: sequelize.drop.bind(sequelize),
  init: sequelize.sync.bind(sequelize),
  Sequelize,
  sequelize
};
