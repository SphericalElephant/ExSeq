'use strict';

describe('sequelize4', () => {
  const Sequelize4 = require('sequelize4');

  require('../index.test')(Sequelize4);
  require('../lib/openapi/sequelize/model-converter.test')(Sequelize4);
  require('../lib/model/sequelize/operator-table.test');
});

