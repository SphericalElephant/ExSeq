'use strict';
const database = require('../../../database');
const {expect} = require('chai');
const {OPERATOR_TABLE} = require('../../../../lib/model/')(database.Sequelize);
describe('operator-table', () => {
  describe('replace', () => {
    it('should replace all keys of an object that have matching operator symbols with the symbol', () => {
      expect(OPERATOR_TABLE.replace({
        where: {
          attr1: {
            like: 'test'
          }
        },
        include: [
          {
            model: 'Model1',
            where: {
              and: [
                {
                  field1: {
                    ne: 'ok'
                  },
                  field2: {
                    eq: 'yes'
                  }
                }
              ]
            }
          },
          {
            model: 'Model2',
            include: [
              {
                model: 'NestedModel1',
                where: {
                  or: [
                    {
                      field1: {
                        contains: 1
                      }
                    },
                    {
                      field2: {
                        contained: true
                      }
                    }
                  ]
                }
              }
            ]
          }
        ]
      })).to.deep.equal({
        where: {
          attr1: {
            [Symbol.for('like')]: 'test'
          }
        },
        include: [
          {
            model: 'Model1',
            where: {
              and: [
                {
                  field1: {
                    [Symbol.for('ne')]: 'ok'
                  },
                  field2: {
                    [Symbol.for('eq')]: 'yes'
                  }
                }
              ]
            }
          },
          {
            model: 'Model2',
            include: [
              {
                model: 'NestedModel1',
                where: {
                  or: [
                    {
                      field1: {
                        [Symbol.for('contains')]: 1
                      }
                    },
                    {
                      field2: {
                        [Symbol.for('contained')]: true
                      }
                    }
                  ]
                }
              }
            ]
          }
        ]
      });
    });
  });
});
