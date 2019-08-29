'use strict';

/* eslint-env node, mocha */
/* eslint no-unused-expressions: "off" */
/* eslint max-len: ["error", { code: 140, "ignoreTemplateLiterals": true }] */

const {expect} = require('chai');
const OPERATOR_TABLE = require('../../../../lib/data-mapper/sequelize/operator-table');

const testData = {
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
};

const dollarNotationTestData = {
  where: {
    attr1: {
      $like: 'test'
    }
  },
  include: [
    {
      model: 'Model1',
      where: {
        $and: [
          {
            field1: {
              $ne: 'ok'
            },
            field2: {
              $eq: 'yes'
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
            $or: [
              {
                field1: {
                  $contains: 1
                }
              },
              {
                field2: {
                  $contained: true
                }
              }
            ]
          }
        }
      ]
    }
  ]
};

describe('operator-table', () => {
  describe('checkAllowed', () => {
    it('should allow everything if no definition was given', () => {
      expect(OPERATOR_TABLE.checkAllowed(undefined, testData).success).to.be.true;
    });
    it('should return an array with disallowed operators in query', () => {
      const result = OPERATOR_TABLE.checkAllowed({or: true, like: true}, testData);
      expect(result.success).to.be.false;
      expect(result.operators).to.not.include.members(['like', 'or']);
      expect(result.operators).to.include.members(['contains', 'contained', 'and', 'ne', 'eq']);
    });
    it('should map equivaltent operators of the definition', () => {
      const result = OPERATOR_TABLE.checkAllowed({$or: true, $like: true, $contains: true}, testData);
      expect(result.success).to.be.false;
      expect(result.operators).to.not.include.members(['like', 'or']);
      expect(result.operators).to.include.members(['contained', 'and', 'ne', 'eq']);
    });
    it('should map equivaltent operators of the test data', () => {
      const result = OPERATOR_TABLE.checkAllowed({or: true, like: true, contains: true}, dollarNotationTestData);
      expect(result.success).to.be.false;
      expect(result.operators).to.include.members(['$contained', '$and', '$ne', '$eq']);
    });
    it('should let the query pass', () => {
      const result = OPERATOR_TABLE.checkAllowed(
        {or: true, like: true, contains: true, $contained: true, and: true, $ne: true, $eq: true},
        dollarNotationTestData
      );
      expect(result.success).to.be.true;
    });
  });
  describe('replace', () => {
    it('should replace all keys of an object that have matching operator symbols with the symbol', () => {
      expect(OPERATOR_TABLE.replace(testData)).to.deep.equal({
        where: {
          attr1: {
            [Symbol.for('like')]: 'test'
          }
        },
        include: [
          {
            model: 'Model1',
            where: {
              [Symbol.for('and')]: [
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
                  [Symbol.for('or')]: [
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
