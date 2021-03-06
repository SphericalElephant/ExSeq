'use strict';

const expect = require('chai').expect;

const {convertModel} = require('../../../../lib/openapi/sequelize/model-converter');
const testModel = require('../../../model/test-model');

module.exports = (Sequelize) => {
  const database = require('../../../database')(Sequelize);
  const TestModel = testModel(database.sequelize, database.Sequelize);
  const modelExtension = require('../../../../lib/model')(database.Sequelize);

  describe('lib/openapi/sequelize/model-converter.js', () => {
    it('should check if a model is provided.', () => {
      expect(convertModel.bind(null, undefined)).to.throw('no model specified!');
    });
    it.skip('should convert sequelize models to openapi models correctly.', () => {
      modelExtension(TestModel);
      expect(convertModel(TestModel)).to.deep.equal({
        'type': 'object',
        'required': [
          'id',
          'value2',
          'value3',
          'createdAt',
          'updatedAt'
        ],
        'properties': {
          'id': {
            'type': {
              'type': 'integer',
              'format': 'int32',
              'cname': 'integer'
            }
          },
          'value1': {
            'type': {
              'type': 'string'
            }
          },
          'value2': {
            'type': {
              'type': 'integer',
              'format': 'int32',
              'cname': 'integer'
            }
          },
          'value3': {
            'type': {
              'type': 'integer',
              'format': 'int32',
              'cname': 'integer'
            }
          },
          'createdAt': {
            'type': {
              'type': 'string',
              'format': 'date-time',
              'cname': 'dateTime'
            }
          },
          'updatedAt': {
            'type': {
              'type': 'string',
              'format': 'date-time',
              'cname': 'dateTime'
            }
          }
        },
        'additionalProperties': {}
      });
    });
  });
};
