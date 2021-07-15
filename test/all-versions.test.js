'use strict';
const versions = {};
['sequelize4', 'sequelize5', 'sequelize6'].forEach(version => {
  describe(version, () => {
    versions[version] = require(version);
    console.log('testing sequelize version', versions[version].version);
    require('./index.test')(versions[version]);
    require('./model/sequelize/model-extension')(versions[version]);
    require('./lib/openapi/sequelize/model-converter.test')(versions[version]);
    require('./lib/data-mapper/sequelize/operator-table.test');
    require('./lib/data-mapper/sequelize/query-builder.test')(versions[version]);
    require('./lib/route/route-exposure-handler.test');
    require('./middleware/relationship.test')(versions[version]);
  });
});

