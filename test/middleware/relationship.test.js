/* eslint-env node, mocha */
/* eslint no-unused-expressions: "off" */
/* eslint max-len: ["error", { code: 140, "ignoreTemplateLiterals": true }] */
'use strict';

const {expect} = require('chai');

const associationMiddleware = require('../../middleware/relationship');
const testModel = require('../model/test-model.js');
const {enhance} = require('../../lib/data-mapper/');

module.exports = (Sequelize) => {
  const database = require('../database')(Sequelize);
  const modelExtension = enhance(database.Sequelize);

  let AssociationMiddleWareTestModel = testModel(database.sequelize, database.Sequelize);
  AssociationMiddleWareTestModel = modelExtension([{model: AssociationMiddleWareTestModel, opts: {}}], AssociationMiddleWareTestModel);

  describe('Middleware', () => {
    describe('associationMiddleware', () => {
      it('should respect config settings', () => {
        const middleware = associationMiddleware([AssociationMiddleWareTestModel], {
          fieldName: 'test'
        });
        const toTest = {};
        middleware(toTest, {}, () => { });
        expect(toTest['test']).to.not.be.null;
      });
      it('should use a default name if no fieldName was specified', () => {
        const middleware = associationMiddleware([AssociationMiddleWareTestModel]);
        const toTest = {};
        middleware(toTest, {}, () => { });
        expect(toTest['associationInformation']).to.not.be.null;
      });
    });
  });
};
