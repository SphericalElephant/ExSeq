'use strict';

const Sequelize5 = require('sequelize5');

describe('sequelize4', () => {
  require('../index.test')(Sequelize5);
  require('../lib/openapi/sequelize/model-converter.test')(Sequelize5);
  require('../lib/model/sequelize/operator-table.test');
});
