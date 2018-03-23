const expect = require('chai').expect;

const convertModel = require('../../../../lib/openapi/sequelize/model-converter');
const database = require('../../../database');
const testModel = require('../../../model/test-model');
const TestModel = testModel(database.sequelize, database.Sequelize);

describe('lib/openapi/sequelize/model-converter.js', () => {
    it('should check if a model is provided.', () => {
        expect(convertModel.bind(null, undefined)).to.throw('no model specified!');
    });
    it('should check if the supplied entity is indeed a sequelize model.', () => {
        expect(convertModel.bind(null, 'test')).to.throw('is not a sequelize Model');
    });
    it('should convert sequelize models to openapi models correctly.', () => {
        expect(convertModel(TestModel)).to.deep.equal({
            "type": "object",
            "required": [
              "id",
              "value2",
              "value3",
              "createdAt",
              "updatedAt"
            ],
            "properties": {
              "id": {
                "type": {
                  "type": "integer",
                  "format": "int32",
                  "cname": "integer"
                }
              },
              "value1": {
                "type": {
                  "type": "string"
                }
              },
              "value2": {
                "type": {
                  "type": "integer",
                  "format": "int32",
                  "cname": "integer"
                }
              },
              "value3": {
                "type": {
                  "type": "integer",
                  "format": "int32",
                  "cname": "integer"
                }
              },
              "createdAt": {
                "type": {
                  "type": "string",
                  "format": "date-time",
                  "cname": "dateTime"
                }
              },
              "updatedAt": {
                "type": {
                  "type": "string",
                  "format": "date-time",
                  "cname": "dateTime"
                }
              }
            }
        });
    });
});