'use strict';

describe('sequelize6', () => {
  const Sequelize6 = require('sequelize6');

  require('../index.test')(Sequelize6);
  require('../lib/openapi/sequelize/model-converter.test')(Sequelize6);
  require('../lib/data-mapper/sequelize/operator-table.test');
  require('../lib/data-mapper/sequelize/query-builder.test')(Sequelize6);
  require('../lib/route/route-exposure-handler.test');
});
