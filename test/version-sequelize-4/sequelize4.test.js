'use strict';

describe('sequelize4', () => {
  const Sequelize4 = require('sequelize4');

  require('../index.test')(Sequelize4);
  require('../lib/openapi/sequelize/model-converter.test')(Sequelize4);
  require('../lib/data-mapper/sequelize/operator-table.test');
  require('../lib/data-mapper/sequelize/query-builder.test')(Sequelize4);
});

