'use strict';
/* eslint-env node, mocha */
/* eslint no-unused-expressions: "off" */
/* eslint max-len: ["error", { code: 140, "ignoreTemplateLiterals": true }] */

const request = require('supertest');
const expect = require('chai').expect;
const Promise = require('bluebird');
const rewire = require('rewire');

const database = require('./database');
const Op = database.Sequelize.Op;
const testModel = require('./model/test-model');
const TestModel = testModel(database.sequelize, database.Sequelize);
const valueString = require('./model/name-string');
const TestModel2 = valueString('TestModel2', database.sequelize, database.Sequelize);
const testModel3 = require('./model/test-model3');
const TestModel3 = testModel3(database.sequelize, database.Sequelize);
const TestModel4 = valueString('TestModel4', database.sequelize, database.Sequelize);
const nameStringValueString = require('./model/name-string-value-string');
const TestModel5 = nameStringValueString('TestModel5', database.sequelize, database.Sequelize);
const TestModel6 = valueString('TestModel6', database.sequelize, database.Sequelize);
const TestModel7 = nameStringValueString('TestModel7', database.sequelize, database.Sequelize);
const TestModel8 = nameStringValueString('TestModel8', database.sequelize, database.Sequelize);
TestModel2.belongsTo(TestModel);
TestModel.hasOne(TestModel3);
const testModel4Testmodel5Association = TestModel4.hasMany(TestModel5);
TestModel7.belongsToMany(TestModel6, {through: 'TestModel6TestModel7'});
const testModel6TestModel7Association = TestModel6.belongsToMany(TestModel7, {through: 'TestModel6TestModel7'});
const AuthorizationAssocChild = valueString('AuthorizationAssocChild', database.sequelize, database.Sequelize);
const AuthorizationAssocParent = valueString('AuthorizationAssocParent', database.sequelize, database.Sequelize);
const AuthorizationAssocParent2 = valueString('AuthorizationAssocParent2', database.sequelize, database.Sequelize);
AuthorizationAssocChild.belongsTo(AuthorizationAssocParent);
AuthorizationAssocParent.hasMany(AuthorizationAssocChild);
const lowerCaseModel = valueString('lowercasemodel', database.sequelize, database.Sequelize);
const anotherLowercaseModel = nameStringValueString('anotherLowercaseModel', database.sequelize, database.Sequelize);
lowerCaseModel.belongsTo(anotherLowercaseModel);
const AliasParent = valueString('AliasParent', database.sequelize, database.Sequelize);
const AliasChild = nameStringValueString('AliasChild', database.sequelize, database.Sequelize);
const aliasParentAliasChildAssociation = AliasParent.hasMany(AliasChild, {as: {singular: 'Child', plural: 'Children'}});
const AliasParentBelongsToMany = valueString('AliasParentBelongsToMany', database.sequelize, database.Sequelize);
const AliasChildBelongsToMany = nameStringValueString('AliasChildBelongsToMany', database.sequelize, database.Sequelize);
const aliasParentBelongsToManyAliasChildBelongsToManyAssociation = AliasParentBelongsToMany.belongsToMany(AliasChildBelongsToMany,
  {through: 'AliasBelongsToMany', as: {singular: 'Child', plural: 'Children'}});
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const _exseq = rewire('../index.js');
const exseq = require('../index');

const _getUpdateableAttributes = _exseq.__get__('_getUpdateableAttributes');
const _removeIllegalAttributes = _exseq.__get__('_removeIllegalAttributes');
const _fillMissingUpdateableAttributes = _exseq.__get__('_fillMissingUpdateableAttributes');
const _obtainExcludeRule = _exseq.__get__('_obtainExcludeRule');
const _shouldRouteBeExposed = _exseq.__get__('_shouldRouteBeExposed');
const _getAuthorizationMiddleWare = _exseq.__get__('_getAuthorizationMiddleWare');
const _getAssociationByModel = _exseq.__get__('_getAssociationByModel');
const alwaysAllowMiddleware = _exseq.__get__('alwaysAllowMiddleware');

const unauthorizedError = new Error();
unauthorizedError.status = 401;

const denyAccess = (req, res, next) => next(unauthorizedError);
const allowAccess = (req, res, next) => next();
const denyFallThrough = (req, res, next) => next(unauthorizedError);

describe('String', () => {
  describe('capitalize', () => {
    it('should capitalize the first letter of a word', () => {
      expect('test'.capitalize()).to.equal('Test');
    });
  });
});

describe('index.js', () => {
  before(done => {
    app.use(bodyParser.json({}));

    exseq([
      {model: TestModel, opts: {}},
      {model: TestModel2, opts: {}},
      {model: TestModel4, opts: {}},
      {model: TestModel5, opts: {}},
      {model: TestModel6, opts: {}},
      {model: TestModel7, opts: {}},
      {model: TestModel8, opts: {}},
      {model: AuthorizationAssocChild, opts: {}},
      {
        model: AuthorizationAssocParent, opts: {
          authorizeWith: {
            options: {
              authorizeForChildren: [
                {child: AuthorizationAssocChild, authorizeForChild: true}
              ]
            },
            rules: {
              CREATE: denyAccess,
              READ: allowAccess,
              SEARCH: allowAccess,
              OTHER: denyFallThrough // any other method
            }
          }
        }
      },
      {model: lowerCaseModel, opts: {}},
      {model: AliasParent, opts: {}},
      {model: AliasChild, opts: {}},
      {model: AliasParentBelongsToMany, opts: {}},
      {model: AliasChildBelongsToMany, opts: {}}
    ]).forEach((routing) => {
      app.use(routing.route, routing.router);
    });

    // simple response handler
    app.use((req, res, next) => {
      if (res.__payload) {
        return res.status(res.__payload.status).send({
          result: res.__payload.result, message: res.__payload.message
        });
      }
      res.status(404).send();
    });
    // simple error handler
    app.use((err, req, res, next) => {
      if (!err.status) {
        return res.status(500).send({message: err.stack});
      }
      return res.status(err.status).send({message: err.result});
    });
    done();
  });

  beforeEach(() => {
    return database.init().then(() => {
      const testModelPromises = [];
      for (let i = 0; i < 49; i++) {
        testModelPromises.push(
          TestModel.create({value1: 'test' + i, value2: i, value3: 'no null!'}).then(testModel => {
            return Promise.join(
              TestModel2.create().then(testModel2 => {
                return testModel2.setTestModel(testModel);
              }),
              TestModel3.create({value1: 'test' + i, value2: 3}).then(testModel3 => {
                return testModel.setTestModel3(testModel3);
              })
            );
          })
        );
      }
      testModelPromises.push(TestModel2.create({name: 'addrelationTestModel2'}));
      testModelPromises.push(TestModel.create({value1: 'addrelationTestModel', value2: 1, value3: 'no null!'}));
      testModelPromises.push(TestModel4.create({name: 'HasMany-parent1'}).then(testModel4 => {
        return Promise.each(
          [
            TestModel5.create({name: 'HasMany-child1', value: 'HasMany-value-child1'}),
            TestModel5.create({name: 'HasMany-child2', value: 'HasMany-value-child2'}),
            TestModel5.create({name: 'HasMany-child3', value: 'HasMany-value-child3'})
          ],
          () => {}
        ).spread((one, two, three) => {
          return Promise.join(testModel4.addTestModel5(one), testModel4.addTestModel5(two), testModel4.addTestModel5(three));
        });
      }));
      testModelPromises.push(TestModel6.create({name: 'BelongsToMany-parent1'}).then(testModel6 => {
        return Promise.each(
          [
            TestModel7.create({name: 'BelongsToMany-child1', value: 'BelongsToMany-value-child1'}),
            TestModel7.create({name: 'BelongsToMany-child2', value: 'BelongsToMany-value-child2'}),
            TestModel7.create({name: 'BelongsToMany-child3', value: 'BelongsToMany-value-child3'})
          ],
          () => {}
        ).spread((one, two, three) => {
          return Promise.join(testModel6.addTestModel7(one), testModel6.addTestModel7(two), testModel6.addTestModel7(three));
        });
      }));
      testModelPromises.push(AliasParentBelongsToMany.create({name: 'BelongsToMany-parent1'}).then(aliasParentBelongsToMany => {
        return Promise.each(
          [
            AliasChildBelongsToMany.create({name: 'BelongsToMany-child1', value: 'BelongsToMany-value-child1'}),
            AliasChildBelongsToMany.create({name: 'BelongsToMany-child2', value: 'BelongsToMany-value-child2'}),
            AliasChildBelongsToMany.create({name: 'BelongsToMany-child3', value: 'BelongsToMany-value-child3'})
          ],
          () => {}
        ).spread((one, two, three) => {
          return Promise.join(
            aliasParentBelongsToMany.addChild(one),
            aliasParentBelongsToMany.addChild(two),
            aliasParentBelongsToMany.addChild(three)
          );
        });
      }));
      testModelPromises.push(lowerCaseModel.create({name: 'lowercase-belongsto'}).then(lowerCaseModelInstance => {
        anotherLowercaseModel.create(
          {name: 'anotherlowercase-belongsto', value: 'anotherlowercase-belongsto-value'}
        ).then(anotherLowercaseModelInstance => {
          return lowerCaseModelInstance.setAnotherLowercaseModel(anotherLowercaseModelInstance);
        });
      }));
      testModelPromises.push(AliasParent.create({name: 'HasMany-parent1'}).then(aliasParentInstance => {
        return Promise.each(
          [
            AliasChild.create({name: 'HasMany-child1', value: 'HasMany-value-child1'}),
            AliasChild.create({name: 'HasMany-child2', value: 'HasMany-value-child2'}),
            AliasChild.create({name: 'HasMany-child3', value: 'HasMany-value-child3'})
          ],
          () => {}
        ).spread((one, two, three) => {
          return Promise.join(
            aliasParentInstance.addChild(one),
            aliasParentInstance.addChild(two),
            aliasParentInstance.addChild(three)
          );
        });
      }));
      return Promise.all(testModelPromises);
    });
  });

  afterEach(() => {
    return database.reset();
  });

  describe('exseq', () => {
    it('should not allow registering the same model twice.', () => {
      expect(exseq.bind(null, [{model: TestModel}, {model: TestModel}])).to.throw('already registered');
    });
    describe('opts', () => {
      describe('opts.route', () => {
        it('should allow setting a custom route name.', () => {
          expect(exseq([
            {
              model: {name: 'DontUseThis'},
              opts: {route: 'UseThis'}
            }
          ])[0].route).to.equal('/UseThis');
        });
        it('should check if the custom route name has already been registered.', () => {
          expect(exseq.bind(null, [
            {
              model: {name: 'UseThis'}
            },
            {
              model: {name: 'DontUseThis'},
              opts: {route: 'UseThis'}
            }
          ])).to.throw('already registered');
        });
      });
      describe('opts.authorizeWith', () => {
        it('should not allow illegal auth types.', () => {
          expect(_getAuthorizationMiddleWare.bind(null, [{model: TestModel, opts: {}}], TestModel, null, 'FOO')).to.throw();
          expect(_getAuthorizationMiddleWare.bind(null, [{model: TestModel, opts: {}}], TestModel, null, 'BAR')).to.throw();
        });
        it('should allow legal auth types.', () => {
          expect(_getAuthorizationMiddleWare.bind(null, [{model: TestModel, opts: {}}], TestModel, null, 'CREATE')).not.to.throw();
          expect(_getAuthorizationMiddleWare.bind(null, [{model: TestModel, opts: {}}], TestModel, null, 'UPDATE_PARTIAL')).not.to.throw();
        });
        it('should use OTHER if there is no specified behaviour for the requested type.', () => {
          expect(
            _getAuthorizationMiddleWare(
              [{model: TestModel, opts: {authorizeWith: {rules: {CREATE: allowAccess, OTHER: denyFallThrough}}}}],
              TestModel,
              null,
              'UPDATE_PARTIAL'
            )
          ).to.equal(denyFallThrough);
        });
        it('should allow access when there is no specified behaviour, but the authorizedWith.rules block is provided.', () => {
          expect(
            _getAuthorizationMiddleWare(
              [{model: TestModel, opts: {authorizeWith: {rules: {}}}}],
              TestModel,
              null,
              'UPDATE_PARTIAL'
            )
          ).to.equal(alwaysAllowMiddleware);
        });
        it('should allow access when there is no specified behaviour, but the authorizedWith block is provided.', () => {
          expect(
            _getAuthorizationMiddleWare(
              [{model: TestModel, opts: {authorizeWith: {}}}],
              TestModel,
              null,
              'UPDATE_PARTIAL'
            )
          ).to.equal(alwaysAllowMiddleware);
        });
        it('should allow access when there is no specified behaviour, and the authorizedWith block is not provided.', () => {
          expect(
            _getAuthorizationMiddleWare(
              [{model: TestModel, opts: {}}],
              TestModel,
              null,
              'UPDATE_PARTIAL'
            )
          ).to.equal(alwaysAllowMiddleware);
        });
        describe('opts.authorizeWith.useParentForAuthorization', () => {
          it('should check that the associatedModel is not null', () => {
            expect(_getAuthorizationMiddleWare.bind(null, [
              {model: TestModel, opts: {authorizeWith: {options: {useParentForAuthorization: true}}}}
            ], TestModel, null, 'OTHER')).to.throw('associatedModel is null');
          });
          it('should check if an association between the models exists', () => {
            expect(_getAuthorizationMiddleWare.bind(null, [
              {model: TestModel8, opts: {authorizeWith: {options: {useParentForAuthorization: true}}}}
            ], TestModel8, AuthorizationAssocChild, 'OTHER')).to.throw('TestModel8 has no association to AuthorizationAssocChild!');
          });
          it('should check if the association between the models is valid', () => {
            expect(_getAuthorizationMiddleWare.bind(null, [
              {model: TestModel4, opts: {authorizeWith: {options: {useParentForAuthorization: true}}}}
            ], TestModel4, TestModel5, 'OTHER'))
              .to.throw('TestModel4 has no BelongsTo / BelongsToMany association to TestModel5, useParentForAuthorization is invalid');
          });
          it('should use the parent authorization if useParentForAuthorization is "true"', () => {
            expect(_getAuthorizationMiddleWare([
              {
                model: AuthorizationAssocChild,
                opts: {authorizeWith: {options: {useParentForAuthorization: true}, rules: {CREATE: denyAccess}}}
              },
              {
                model: AuthorizationAssocParent,
                opts: {authorizeWith: {options: {}, rules: {CREATE: allowAccess}}}
              }
            ], AuthorizationAssocChild, AuthorizationAssocParent, 'CREATE')).to.equal(allowAccess);
          });
          it('should not use the parent authorization if useParentForAuthorization is not set or is set to false', () => {
            expect(_getAuthorizationMiddleWare([
              {
                model: AuthorizationAssocChild,
                opts: {authorizeWith: {options: {useParentForAuthorization: false}, rules: {CREATE: denyAccess}}}
              },
              {
                model: AuthorizationAssocParent,
                opts: {authorizeWith: {options: {}, rules: {CREATE: allowAccess}}}
              }
            ], AuthorizationAssocChild, AuthorizationAssocParent, 'CREATE')).to.equal(denyAccess);
            expect(_getAuthorizationMiddleWare([
              {
                model: AuthorizationAssocChild,
                opts: {authorizeWith: {options: {}, rules: {CREATE: denyAccess}}}
              },
              {
                model: AuthorizationAssocParent,
                opts: {authorizeWith: {options: {}, rules: {CREATE: allowAccess}}}
              }
            ], AuthorizationAssocChild, AuthorizationAssocParent, 'CREATE')).to.equal(denyAccess);
          });
        });
        describe('opts.authorizeWith.authorizeForChildren', () => {
          it('should obtain the parent\'s authorization', () => {
            expect(_getAuthorizationMiddleWare([
              {model: AuthorizationAssocChild, opts: {authorizeWith: {options: {}, rules: {CREATE: denyAccess}}}},
              {
                model: AuthorizationAssocParent, opts: {
                  authorizeWith: {
                    options: {
                      authorizeForChildren: [
                        {child: AuthorizationAssocChild, authorizeForChild: true}
                      ]
                    }, rules: {CREATE: allowAccess}
                  }
                }
              }
            ], AuthorizationAssocChild, null, 'CREATE')).to.equal(allowAccess);
          });
          it('must not accept multiple parents demanding authorization juristriction', () => {
            expect(_getAuthorizationMiddleWare.bind(null, [
              {model: AuthorizationAssocChild, opts: {authorizeWith: {options: {}, rules: {CREATE: denyAccess}}}},
              {
                model: AuthorizationAssocParent, opts: {
                  authorizeWith: {
                    options: {
                      authorizeForChildren: [
                        {child: AuthorizationAssocChild, authorizeForChild: true}
                      ]
                    }, rules: {CREATE: allowAccess}
                  }
                }
              },
              {
                model: AuthorizationAssocParent2, opts: {
                  authorizeWith: {
                    options: {
                      authorizeForChildren: [
                        {child: AuthorizationAssocChild, authorizeForChild: true}
                      ]
                    }, rules: {CREATE: allowAccess}
                  }
                }
              }
            ], AuthorizationAssocChild, null, 'CREATE')).to.throw('invalid number of middlewares expected 1, got 2!');
          });
        });
        describe('Authorize /AuthorizationAssocParent/', () => {
          it('must prevent creation of a new AuthorizationAssocParent', async () => {
            return request(app)
              .post('/AuthorizationAssocParent')
              .send({name: 'brr'})
              .expect(401);
          });
          it('must prevent creation of a new AuthorizationAssocParent\'s AuthorizationAssocChild', async () => {
            return request(app)
              .post('/AuthorizationAssocParent/1/AuthorizationAssocChild')
              .send({name: 'brr'})
              .expect(401);
          });
        });
      });
    });
  });

  describe('_getAssociationByModel', () => {
    it('should be able to handle normal plurals', () => {
      expect(_getAssociationByModel(TestModel4, TestModel5)).to.equal(testModel4Testmodel5Association);
    });
    it('should be able to handle irregular plurals', () => {
      expect(_getAssociationByModel(AliasParent, AliasChild)).to.equal(aliasParentAliasChildAssociation);
    });
  });

  describe('_getUpdateableAttributes', () => {
    it('should return a list of all attributes, without fields that are managed by the ORM or the database.', () => {
      expect(_getUpdateableAttributes(TestModel)).to.deep.equal([
        {attribute: 'value1', allowNull: true},
        {attribute: 'value2', allowNull: true},
        {attribute: 'value3', allowNull: false}]);
    });
    it('should strip attributes that are relvant for relations', () => {
      expect(_getUpdateableAttributes(TestModel3).TestModelId).to.not.exist;
    });
  });

  describe('_removeIllegalAttributes', () => {
    it('should remove illegal arguments.', () => {
      expect(_removeIllegalAttributes(TestModel, {this: 1, is: 1, a: 1, test: 1})).to.deep.equal({});
    });
    it('should retain legal arguments.', () => {
      expect(_removeIllegalAttributes(TestModel, {this: 1, is: 1, a: 1, test: 1, value1: 'should stay'}))
        .to.deep.equal({value1: 'should stay'});
    });
  });

  const rules = [
    {
      method: 'GET',
      relation: 'r1'
    },
    {
      method: 'GET',
      relation: 'r1',
      all: false
    },
    {
      method: 'GET'
    },
    {
      method: 'GET',
      relation: 'r2',
      all: true
    },
    {
      method: 'GET',
      relation: 'r3'
    }
  ];

  describe('_shouldRouteBeExposed', () => {
    it('should return false if a route should not be exposed.', () => {
      expect(_shouldRouteBeExposed(rules, 'GET', 'r5', false)).to.be.false;
    });
    it('should return true if a route should be exposed.', () => {
      expect(_shouldRouteBeExposed(rules, 'GET', 'r1', true)).to.be.true;
      expect(_shouldRouteBeExposed(rules, 'GET', 'r2')).to.be.true;
    });
  });

  describe('_obtainExcludeRule', () => {
    it('should return the correct exclude rule', () => {
      expect(_obtainExcludeRule(rules, 'GET', 'r1')).to.equal(rules[0]);
      expect(_obtainExcludeRule(rules, 'GET', 'r1', false)).to.equal(rules[1]);
      expect(_obtainExcludeRule(rules, 'GET')).to.equal(rules[2]);
      expect(_obtainExcludeRule(rules, 'GET', 'r2', true)).to.equal(rules[3]);
    });
    it('it should treat "true" as default value for all', () => {
      expect(_obtainExcludeRule(rules, 'GET', 'r2')).to.equal(rules[3]);
      expect(_obtainExcludeRule(rules, 'GET', 'r3')).to.equal(rules[4]);
    });
    it('it should undefined if no rule matching the inquiry was found.', () => {
      expect(_obtainExcludeRule(rules, 'POST', 'r2')).to.be.undefined;
      expect(_obtainExcludeRule(rules, 'GET', 'r3', false)).to.be.undefined;
    });
  });

  describe('_fillMissingUpdateableAttributes', () => {
    it('should fill up missing model members with null.', () => {
      expect(_fillMissingUpdateableAttributes(TestModel, {})).to.deep.equal({
        value1: null,
        value2: null,
        value3: null
      });
    });
    it('should not overwrite existing members.', () => {
      expect(_fillMissingUpdateableAttributes(TestModel, {value1: 'test'})).to.deep.equal({
        value1: 'test',
        value2: null,
        value3: null
      });
    });
  });

  describe('/model POST', () => {
    it('should create an instance.', () => {
      return request(app)
        .post('/TestModel')
        .send({value1: 'test1', value2: 1, value3: 'not null'})
        .expect(201)
        .then(response => {
          expect(response.body.result.value1).to.equal('test1');
          expect(response.body.result.value2).to.equal(1);
        });
    });

    it('should create a validation error.', () => {
      return request(app)
        .post('/TestModel')
        .send({value1: 'test1', value2: 101, value3: 'not null'})
        .expect(400)
        .then(response => {
          expect(response.body.message).to.deep.equal([{type: 'Validation error', path: 'value2', value: 101}]);
        });
    });
  });

  describe('/model/search POST', async () => {
    it('should find instance that match the search query', () => {
      return request(app)
        .post('/TestModel/search')
        .send({s: {value1: 'test1'}})
        .expect(200)
        .then(response => {
          expect(response.header['x-total-count']).to.equal('1');
          expect(response.body.result.length).to.equal(1);
          expect(response.body.result[0].value1).to.deep.equal('test1');
        });
    });
    it('should find instance that match the search query 2', () => {
      return request(app)
        .post('/TestModel/search')
        .send({s: {value1: {'$like': 'test%'}}})
        .expect(200)
        .then(response => {
          expect(response.header['x-total-count']).to.equal('49');
          expect(response.body.result.length).to.equal(10);
        });
    });
    it('should return a 204 if no items where found', () => {
      return request(app)
        .post('/TestModel/search')
        .send({s: {value1: 'asdasdasdasd'}})
        .expect(204)
        .then(response => {
          expect(response.header['x-total-count']).to.equal('0');
        });
    });
  });

  describe('/model GET', () => {
    it('should validate that offset and limit are both set if one is set.', () => {
      return Promise.join(
        request(app)
          .get('/TestModel?p=1')
          .expect(400)
          .then(response => {
            expect(response.body).to.deep.equal({message: 'p or i must be both undefined or both defined.'});
          }),
        request(app)
          .get('/TestModel?i=1')
          .expect(400)
          .then(response => {
            expect(response.body).to.deep.equal({message: 'p or i must be both undefined or both defined.'});
          })
      );
    });
    it('should validate that offset and limit are integers.', () => {
      return Promise.join(
        request(app)
          .get('/TestModel?p=test&i=1')
          .expect(400)
          .then(response => {
            expect(response.body).to.deep.equal({message: 'p or i must be integers larger than 0!'});
          }),
        request(app)
          .get('/TestModel?i=test&p=1')
          .expect(400)
          .then(response => {
            expect(response.body).to.deep.equal({message: 'p or i must be integers larger than 0!'});
          }),
        request(app)
          .get('/TestModel?i=-1&p=0')
          .expect(400)
          .then(response => {
            expect(response.body).to.deep.equal({message: 'p or i must be integers larger than 0!'});
          }),
        request(app)
          .get('/TestModel?p=0&i=-1')
          .expect(400)
          .then(response => {
            expect(response.body).to.deep.equal({message: 'p or i must be integers larger than 0!'});
          }),
        request(app)
          .get('/TestModel?p=0&i=1')
          .expect(200)
          .then(response => {
            expect(response.body.result.length).to.equal(1);
          }),
        request(app)
          .get('/TestModel')
          .expect(200)
          .then(response => {
            expect(response.body.result.length).to.equal(10);
          })
      );
    });
    it('should paginate according to offset and limit.', () => {
      return request(app)
        .get('/TestModel?p=1&i=10')
        .expect(200)
        .then(response => {
          expect(response.body.result.length).to.equal(10);
          expect(response.body.result[0].id).to.equal(11);
          expect(response.body.result[response.body.result.length - 1].id).to.equal(20);
        });
    });
    it('should only show attributes that have been specified.', () => {
      return request(app)
        .get('/TestModel?a=value1&p=1&i=1')
        .expect(200)
        .then(response => {
          expect(response.body).to.deep.equal({result: [{value1: 'test1'}]});
        });
    });
    it('should not allow invalid sort orders.', () => {
      return request(app)
        .get('/TestModel?p=1&i=10&f=value1&o=INVALID')
        .expect(400)
        .then(response => {
          expect(response.body).to.deep.equal({message: 'invalid sort order, must be DESC or ASC'});
        });
    });
    it('should sort according to given order and field.', () => {
      return request(app)
        .get('/TestModel?p=1&i=10&f=value1&o=ASC')
        .expect(200)
        .then(response => {
          expect(response.body.result[0].id).to.equal(18);
          expect(response.body.result[1].id).to.equal(19);
          expect(response.body.result[2].id).to.equal(20);
        });
    });
    it('should return the number of entities', () => {
      return request(app)
        .get('/TestModel/count')
        .expect(200)
        .then(response => {
          expect(response.body.result).to.equal(50);
        });
    });
  });
  describe('/model/:id GET', () => {
    it('should return an item by id.', () => {
      return request(app)
        .get('/TestModel/1')
        .expect(200)
        .then(response => {
          expect(response.body.result.id).to.equal(1);
        });
    });
    it('should only return the specified attributes.', () => {
      return request(app)
        .get('/TestModel/1?a=value1')
        .expect(200)
        .then(response => {
          expect(response.body).to.deep.equal({result: {value1: 'test0'}});
        });
    });
    it('should return 404 if the entity was not found.', () => {
      return request(app)
        .get('/TestModel/1000')
        .expect(404).then(response => {
          expect(response.body).to.deep.equal({message: 'entity not found.'});
        });
    });
  });
  describe('/model/:id DELETE', () => {
    it('should delete an instance.', () => {
      return request(app)
        .delete('/TestModel/1')
        .expect(204)
        .then(response => {
          return TestModel.findOne({where: {id: 1}}).then(instance => {
            expect(instance).to.not.exist;
          });
        });
    });
    it('should inform callers that an instance does not exist.', () => {
      return request(app)
        .delete('/TestModel/0')
        .expect(404);
    });
  });
  describe('/model/:id PUT', () => {
    it('should replace an instance.', () => {
      return request(app)
        .put('/TestModel/1')
        .send({value3: 'changed'})
        .expect(204)
        .then(response => {
          return TestModel.findOne({where: {id: 1}}).then(instance => {
            const result = instance.get({plain: true});
            expect(result.value1).to.be.null;
            expect(result.value2).to.be.null;
            expect(result.value3).to.equal('changed');
          });
        });
    });
    it('should inform callers that an instance does not exist.', () => {
      return request(app)
        .put('/TestModel/0')
        .send({value3: 'changed'})
        .expect(404);
    });
  });
  describe('/model/:id PATCH', () => {
    it('should update invididual attributes of a record.', () => {
      return request(app)
        .patch('/TestModel/1')
        .send({value3: 'changed'})
        .expect(204)
        .then(response => {
          return TestModel.findOne({where: {id: 1}}).then(instance => {
            const result = instance.get({plain: true});
            expect(result.value1).to.equal('test0');
            expect(result.value2).to.equal(0);
            expect(result.value3).to.equal('changed');
          });
        });
    });
    it('should inform callers that an instance does not exist.', () => {
      return request(app)
        .patch('/TestModel/0')
        .send({value3: 'changed'})
        .expect(404);
    });
  });
  describe('/model/:id/belongsTo & hasOne/ ALL - 404', () => {
    ['get', 'post', 'put', 'delete'].forEach(verb => {
      it(`should inform callers that the source does not exist: ${verb}.`, () => {
        return request(app)[verb]('/TestModel2/1000/TestModel/')
          .expect(404)
          .then(response => {
            expect(response.body.message).to.equal('source not found.');
          });
      });
    });
    // DELETE and POST are special, POST creates a target and DELETE unsets a target
    ['get', 'put'].forEach(verb => {
      it(`should inform callers that the target does not exist: ${verb}.`, () => {
        return TestModel2.findOne({where: {name: 'addrelationTestModel2'}}).then(testModel2Instance => {
          return request(app)[verb](`/TestModel2/${testModel2Instance.id}/TestModel/`)
            .expect(404)
            .then(response => {
              expect(response.body.message).to.equal('target not found.');
            });
        });
      });
    });
    it('should only show attributes that have been specified.', () => {
      return request(app)
        .get('/lowerCaseModel/1/anotherLowerCaseModel?a=value')
        .expect(200)
        .then(response => {
          expect(response.body).to.deep.equal({result: {value: 'anotherlowercase-belongsto-value'}});
        });
    });
  });
  describe('/model/:id/belongsToRelation/ GET', () => {
    it('should return the belongsTo relation of the requested resource.', () => {
      return request(app)
        .get('/TestModel2/5/TestModel/')
        .expect(200)
        .then(response => {
          expect(response.body.result.id).to.equal(4);
        });
    });
    it('should be able to handle models that start with a lowercase letter.', () => {
      return request(app)
        .get('/lowerCaseModel/1/anotherLowerCaseModel/')
        .expect(200)
        .then(response => {
          expect(response.body.result.id).to.equal(1);
        });
    });
  });
  describe('/model/:id/belongsToRelation/ POST', () => {
    it('should create the belongsTo relation of the resource', () => {
      return TestModel2.findOne({where: {name: 'addrelationTestModel2'}}).then(testModel2Instance => {
        return request(app)
          .post(`/TestModel2/${testModel2Instance.get({plain: true}).id}/TestModel/`)
          .send({
            value1: 'teststring1',
            value2: 1,
            value3: 'teststring2'
          })
          .expect(201)
          .then(response => {
            expect(response.body.result.value1).to.equal('teststring1');
            expect(response.body.result.value2).to.equal(1);
            expect(response.body.result.value3).to.equal('teststring2');
          });
      });
    });
  });
  describe('/model/:id/belongsToRelation/ PUT', () => {
    it('should update the belongsTo relation of the resource', () => {
      return request(app)
        .put('/TestModel2/5/TestModel/')
        .send({
          value1: 'changed1',
          value2: 2,
          value3: 'changed2'
        })
        .expect(204)
        .then(response => {
          return TestModel2.findById(5).then(testModel2Instance => {
            return testModel2Instance.getTestModel().then(testModelInstance => {
              const plainInstance = testModelInstance.get({plain: true});
              expect(plainInstance.value1).to.equal('changed1');
              expect(plainInstance.value2).to.equal(2);
              expect(plainInstance.value3).to.equal('changed2');
            });
          });
        });
    });
  });
  describe('/model/:id/belongsToRelation/ PATCH', () => {
    it('should update individual attributes of the belongsTo relation of the resource', () => {
      return request(app)
        .patch('/TestModel2/5/TestModel/')
        .send({value1: 'changed1'})
        .expect(204)
        .then(response => {
          return TestModel2.findById(5).then(testModel2Instance => {
            return testModel2Instance.getTestModel().then(testModelInstance => {
              const plainInstance = testModelInstance.get({plain: true});
              expect(plainInstance.value1).to.equal('changed1');
              expect(plainInstance.value2).to.equal(3);
              expect(plainInstance.value3).to.equal('no null!');
            });
          });
        });
    });
  });
  describe('/model/:id/belongsToRelation/ DELETE', () => {
    it('should delete the belongsTo relation of the resource', () => {
      return request(app)
        .delete('/TestModel2/5/TestModel/')
        .expect(204)
        .then(response => {
          return TestModel2.findById(5).then(testModel2Instance => {
            return testModel2Instance.getTestModel().then(testModelInstance => {
              expect(testModelInstance).to.not.exist;
            });
          });
        });
    });
  });
  describe('/model/:id/hasOneRelation/ GET', () => {
    it('should return the belongsTo relation of the requested resource', () => {
      return request(app)
        .get('/TestModel/1/TestModel3/')
        .expect(200)
        .then(response => {
          expect(response.body.result.id).to.equal(1);
          expect(response.body.result.TestModelId).to.equal(1);
        });
    });
  });
  describe('/model/:id/hasOneRleation/ POST', () => {
    it('should create the hasOne relation of the resource', () => {
      return TestModel.findOne({where: {value1: 'addrelationTestModel'}}).then(testModelInstance => {
        return request(app)
          .post(`/TestModel/${testModelInstance.get({plain: true}).id}/TestModel3/`)
          .send({
            value1: 'teststring1'
          })
          .expect(201)
          .then(response => {
            expect(response.body.result.value1).to.equal('teststring1');
          });
      });
    });
  });
  describe('/model/:id/hasOneRelation/ PUT', () => {
    it('should update the hasOne relation of the resource', () => {
      return request(app)
        .put('/TestModel/5/TestModel3/')
        .send({
          value1: 'changed1'
        })
        .expect(204)
        .then(response => {
          return TestModel.findById(5).then(testModelInstance => {
            return testModelInstance.getTestModel3().then(testModel3Instance => {
              const plainInstance = testModel3Instance.get({plain: true});
              expect(plainInstance.value1).to.equal('changed1');
              // TODO: test for reset
            });
          });
        });
    });
  });
  describe('/model/:id/hasOneRelation/ PATCH', () => {
    it('should update individual attributes of the hasOne relation of the resource', () => {
      return request(app)
        .patch('/TestModel/5/TestModel3/')
        .send({value1: 'changed'})
        .expect(204)
        .then(response => {
          return TestModel.findById(5).then(testModelInstance => {
            return testModelInstance.getTestModel3().then(testModel3Instance => {
              const plainInstance = testModel3Instance.get({plain: true});
              expect(plainInstance.value1).to.equal('changed');
              expect(plainInstance.value2).to.equal(3);
            });
          });
        });
    });
  });
  describe('/model/:id/hasOneRelation/ DELETE', () => {
    it('should delete the hasOne relation of the resource', () => {
      return request(app)
        .delete('/TestModel/5/TestModel3/')
        .expect(204)
        .then(response => {
          return TestModel.findById(5).then(testModelInstance => {
            return testModelInstance.getTestModel3().then(testModel3Instance => {
              expect(testModel3Instance).to.not.exist;
            });
          });
        });
    });
  });

  describe('many', () => {
    const sortByField = (field, a, b) => {
      if (a[field] < b[field]) return -1;
      if (a[field] > b[field]) return 1;
      return 0;
    };
    const sortById = sortByField.bind(null, 'id');
    const sortByValue = sortByField.bind(null, 'value');
    [
      {
        source: TestModel4, sourceName: 'TestModel4', target: TestModel5,
        association: testModel4Testmodel5Association, associationName: 'TestModel5'
      },
      {
        source: TestModel6, sourceName: 'TestModel6', target: TestModel7,
        association: testModel6TestModel7Association, associationName: 'TestModel7'
      },
      // test proper aliasing and pluralization
      {
        source: AliasParent, sourceName: 'AliasParent', target: AliasChild,
        association: aliasParentAliasChildAssociation, associationName: 'Child', searchFor: 'HasMany-child1'
      },
      {
        source: AliasParentBelongsToMany, sourceName: 'AliasParentBelongsToMany', target: AliasChildBelongsToMany,
        association: aliasParentBelongsToManyAliasChildBelongsToManyAssociation, associationName: 'Child', searchFor: 'BelongsToMany-child1'
      }
    ].forEach(manyRelation => {
      if (manyRelation.source !== AliasParentBelongsToMany) {
        it('must meet preconditions.', () => {
          expect(manyRelation.source.name).to.equal(manyRelation.sourceName);
          expect(manyRelation.association.options.name.singular).to.equal(manyRelation.associationName);
        });
        describe(`/model/:id/${manyRelation.association.associationType}/ GET`, () => {
          it(`should return the ${manyRelation.association.associationType} relations of the requested resource.`, () => {
            return request(app)
              .get(`/${manyRelation.source.name}/1/${manyRelation.association.options.name.singular}/`)
              .expect(200)
              .then(response => {
                expect(response.body.result).to.have.lengthOf(3);
                expect(response.body.result.sort(sortById)[0].name).to.equal(`${manyRelation.association.associationType}-child1`);
              });
          });
          it('should only show attributes that have been specified.', () => {
            return request(app)
              .get(`/${manyRelation.source.name}/1/${manyRelation.association.options.name.singular}/?a=value`)
              .expect(200)
              .then(response => {
                expect(response.body.result).to.have.lengthOf(3);
                expect(response.body.result.sort(sortByValue)).to.deep.equal(
                  [
                    {
                      value: `${manyRelation.association.associationType}-value-child1`
                    },
                    {
                      value: `${manyRelation.association.associationType}-value-child2`
                    },
                    {
                      value: `${manyRelation.association.associationType}-value-child3`
                    }
                  ]
                );
              });
          });
        });
        describe(`/model/:id/${manyRelation.association.associationType}/count GET`, () => {
          it(`should return the ${manyRelation.association.associationType} relations count of the requested resource.`, () => {
            return request(app)
              .get(`/${manyRelation.source.name}/1/${manyRelation.association.options.name.singular}/count`)
              .expect(200)
              .then(response => {
                expect(response.body.result).to.equal(3);
              });
          });
        });
        describe(`/model/:id/${manyRelation.association.associationType}/:targetId GET`, () => {
          it(`should return the ${manyRelation.association.associationType} relation of the requested resource with the specified id.`,
            () => {
              return request(app)
                .get(`/${manyRelation.source.name}/1/${manyRelation.association.options.name.singular}/2`)
                .expect(200)
                .then(response => {
                  expect(response.body.result.name).to.equal(`${manyRelation.association.associationType}-child2`);
                });
            });
          it('should only show attributes that have been specified.', () => {
            return request(app)
              .get(`/${manyRelation.source.name}/1/${manyRelation.association.options.name.singular}/2?a=value`)
              .expect(200)
              .then(response => {
                expect(response.body).to.deep.equal({
                  result: {
                    value: `${manyRelation.association.associationType}-value-child2`
                  }
                });
              });
          });
        });
        describe('/model/:id/hasManyRelation/ POST', () => {
          it('should add an item to the hasMany relation of the source. ', () => {
            return manyRelation.source.findOne({where: {name: `${manyRelation.association.associationType}-parent1`}})
              .then(sourceInstance => {
                return request(app)
                  .post(
                    `/${manyRelation.source.name}/${sourceInstance.get({plain: true}).id}/${manyRelation.association.options.name.singular}/`
                  )
                  .send({
                    name: `${manyRelation.association.associationType}-child4`
                  })
                  .expect(201)
                  .then(response => {
                    expect(response.body.result.name).to.equal(`${manyRelation.association.associationType}-child4`);
                    return manyRelation.source.findOne({where: {name: `${manyRelation.association.associationType}-parent1`}})
                      .then(sourceInstance => {
                        return sourceInstance[manyRelation.association.accessors.get]().then(targetInstances => {
                          expect(targetInstances).to.have.lengthOf(4);
                          expect(targetInstances[3].name).to.equal(`${manyRelation.association.associationType}-child4`);
                        });
                      });
                  });
              });
          });
        });
        describe('/model/:id/hasManyRelation/ PUT', () => {
          it(`should update a ${manyRelation.association.associationType} relation of the resource`, () => {
            return request(app)
              .put(`/${manyRelation.source.name}/1/${manyRelation.association.options.name.singular}/1/`)
              .send({name: 'changed1'})
              .expect(204)
              .then(response => {
                return manyRelation.source.findById(1).then(sourceInstance => {
                  return sourceInstance[manyRelation.association.accessors.get]({where: {name: 'changed1'}}).then(targetInstances => {
                    const plainInstance = targetInstances[0].get({plain: true});
                    expect(plainInstance.name).to.equal('changed1');
                    expect(plainInstance.value).to.be.null;
                  });
                });
              });
          });
        });
        describe('/model/:id/hasManyRelation/ PATCH', () => {
          it(`should update individual attributes of a ${manyRelation.association.associationType} relation of the resource`, () => {
            return request(app)
              .patch(`/${manyRelation.source.name}/1/${manyRelation.association.options.name.singular}/1/`)
              .send({name: 'changed'})
              .expect(204)
              .then(response => {
                return manyRelation.source.findById(1).then(sourceInstance => {
                  return sourceInstance[manyRelation.association.accessors.get]({where: {id: 1}}).then(targetInstances => {
                    const plainInstance = targetInstances[0].get({plain: true});
                    expect(plainInstance.name).to.equal('changed');
                    expect(plainInstance.value).to.equal(`${manyRelation.association.associationType}-value-child1`);
                  });
                });
              });
          });
        });
        describe('/model/:id/hasManyRelation/ DELETE', () => {
          it(`should delete all ${manyRelation.association.associationType} relations of the resource`, () => {
            return request(app)
              .delete(`/${manyRelation.source.name}/1/${manyRelation.association.options.name.singular}`)
              .expect(204)
              .then(response => {
                return manyRelation.source.findById(1).then(sourceInstance => {
                  return sourceInstance[manyRelation.association.accessors.get]().then(targetInstances => {
                    expect(targetInstances).to.have.lengthOf(0);
                  });
                });
              });
          });
        });
        it(`should delete a specific ${manyRelation.association.associationType} relation of the resource`, () => {
          return request(app)
            .delete(`/${manyRelation.source.name}/1/${manyRelation.association.options.name.singular}/1`)
            .expect(204)
            .then(response => {
              return manyRelation.source.findById(1).then(sourceInstance => {
                return sourceInstance[manyRelation.association.accessors.get]().then(targetInstances => {
                  expect(targetInstances).to.have.lengthOf(2);
                });
              });
            });
        });
        it(`should return 404 if the ${manyRelation.association.associationType} relation does not exist for the resource`, () => {
          return request(app)
            .delete(`/${manyRelation.source.name}/1/${manyRelation.association.options.name.singular}/5`)
            .expect(404)
            .then(response => {
              expect(response.body.message).to.equal('target not found.');
            });
        });
      }
      // only use AliasParent and AliasParentBelongsToMany for the search
      if (manyRelation.source === AliasParentBelongsToMany || manyRelation.source === AliasParent) {
        describe(`/model/:id/${manyRelation.association.associationType}/search/ POST`, () => {
          it('should return the instances of the child model that match the search criteria', () => {
            return request(app).post(`/${manyRelation.source.name}/1/${manyRelation.association.options.name.singular}/search`)
              .send({s: {name: manyRelation.searchFor}})
              .expect(200)
              .then(response => {
                expect(response.header['x-total-count']).to.equal('1');
                expect(response.body.result).to.have.lengthOf(1);
                expect(response.body.result[0].name).to.equal(manyRelation.searchFor);
              });
          });
          it('should return the instances of the child model that match the search criteria 2', () => {
            return request(app).post(`/${manyRelation.source.name}/1/${manyRelation.association.options.name.singular}/search`)
              .send({
                s: {
                  name: {
                    '$like': `%${manyRelation.association.associationType}%`
                  }
                }
              })
              .expect(200)
              .then(response => {
                expect(response.header['x-total-count']).to.equal('3');
                expect(response.body.result).to.have.lengthOf(3);
              });
          });
          it('should return 204 if no child has been found.', () => {
            return request(app).post(`/${manyRelation.source.name}/1/${manyRelation.association.options.name.singular}/search`)
              .send({s: {name: 'testing search'}})
              .expect(204)
              .then(response => {
                expect(response.header['x-total-count']).to.equal('0');
              });
          });
          it('should respect other query parameters such as "a".', () => {
            return request(app).post(`/${manyRelation.source.name}/1/${manyRelation.association.options.name.singular}/search`)
              .send({s: {name: manyRelation.searchFor}, a: 'name'})
              .expect(200)
              .then(response => {
                expect(response.header['x-total-count']).to.equal('1');
                expect(response.body.result).have.lengthOf(1);
                expect(response.body.result[0]).to.deep.equals({name: manyRelation.searchFor});
              });
          });
        });
      }
    });
  });
});
