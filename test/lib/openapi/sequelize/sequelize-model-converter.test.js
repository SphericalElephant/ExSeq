const expect = require('chai').expect;

const convertModel = require('../../../../lib/openapi/sequelize/sequelize-model-converter');
const database = require('../../../database');
const testModel = require('../../../model/test-model');
const TestModel = testModel(database.sequelize, database.Sequelize);

describe('lib/openapi/sequelize/sequelize-model-converter.js', () => {
    it('should check if the supplied entity is indeed a sequelize model.', () => {
        expect(convertModel.bind(null, 'test')).to.throw('is not a sequelize Model');
    });
    it('should foo', () => {
        convertModel(TestModel);
    });
});