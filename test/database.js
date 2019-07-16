'use strict';

function getSequelizeVersion(v) {
  switch (v) {
    case 'sequelize4':
    case 'sequelize5':
      return require(v);
    default: throw new Error(`unsupported sequelize verion ${v}`);
  }
}

let sequelize;
function getSequelize(version) {
  const Sequelize = getSequelizeVersion(version);
  if (!sequelize) {
    sequelize = new Sequelize('', '', '', {storage: ':memory:', dialect: 'sqlite', logging: false});
  }
  return sequelize;
}
module.exports = (version) => {
  const Sequelize = getSequelizeVersion(version);
  const sequelize = getSequelize(version);
  return {
    reset: sequelize.drop.bind(sequelize),
    init: sequelize.sync.bind(sequelize),
    Sequelize,
    sequelize
  };
};
