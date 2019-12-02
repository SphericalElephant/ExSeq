'use strict';

describe('sequelize5', () => {
  const Sequelize5 = require('sequelize5');

  require('../index.test')(Sequelize5);
  require('../lib/openapi/sequelize/model-converter.test')(Sequelize5);
  require('../lib/data-mapper/sequelize/operator-table.test');
  require('../lib/data-mapper/sequelize/query-builder.test')(Sequelize5);
  require('../lib/route/route-exposure-handler.test');
});
