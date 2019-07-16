'use strict';

module.exports = (Sequelize) => {
  const sequelize = new Sequelize('', '', '', {storage: ':memory:', dialect: 'sqlite', logging: false});
  return {
    reset: sequelize.drop.bind(sequelize),
    init: sequelize.sync.bind(sequelize),
    sequelize,
    Sequelize
  };
};
