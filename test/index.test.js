'use strict';
/* eslint-env node, mocha */
/* eslint no-unused-expressions: "off" */
/* eslint max-len: ["error", { code: 140, "ignoreTemplateLiterals": true }] */
const request = require('supertest');
const expect = require('chai').expect;
const Promise = require('bluebird');
const rewire = require('rewire');
const express = require('express');

const bodyParser = require('body-parser');

const valueString = require('./model/name-string');
const nameStringValueString = require('./model/name-string-value-string');
const testModelVirtualFields = require('./model/test-model-virtual-type');
const uuidTestModel = require('./model/uuid-model');
const testModel = require('./model/test-model');
const testModel3 = require('./model/test-model3');

const _exseq = rewire('../index.js');
const exseq = require('../index');
const modelExtensionImport = require('../lib/model');
const AssociationInformation = require('../lib/association-information');
const associationMiddleware = require('../middleware/relationship');

const unauthorizedError = new Error();
unauthorizedError.status = 401;

const denyAccess = (req, res, next) => next(unauthorizedError);
const allowAccess = (req, res, next) => next();
const denyFallThrough = (req, res, next) => next(unauthorizedError);

const _obtainExcludeRule = _exseq.__get__('_obtainExcludeRule');
const _shouldRouteBeExposed = _exseq.__get__('_shouldRouteBeExposed');
const _getAuthorizationMiddleWare = _exseq.__get__('_getAuthorizationMiddleWare');
const _createReplyObject = _exseq.__get__('_createReplyObject');
const alwaysAllowMiddleware = _exseq.__get__('alwaysAllowMiddleware');

module.exports = (Sequelize) => {
  const app = express();
  const database = require('./database')(Sequelize);
  const modelExtension = modelExtensionImport(database.Sequelize);
  const TestModelVirtualFields = testModelVirtualFields(database.sequelize, database.Sequelize);
  const TestModel = testModel(database.sequelize, database.Sequelize);
  const TestModel2 = valueString('TestModel2', database.sequelize, database.Sequelize);
  const TestModel3 = testModel3(database.sequelize, database.Sequelize);
  const TestModel4 = valueString('TestModel4', database.sequelize, database.Sequelize);
  const TestModel5 = nameStringValueString('TestModel5', database.sequelize, database.Sequelize);
  const TestModel6 = valueString('TestModel6', database.sequelize, database.Sequelize);
  const TestModel7 = nameStringValueString('TestModel7', database.sequelize, database.Sequelize);
  const TestModel8 = nameStringValueString('TestModel8', database.sequelize, database.Sequelize);
  TestModel2.belongsTo(TestModel);
  TestModel.hasOne(TestModel3);
  const testModel4Testmodel5Association = TestModel4.hasMany(TestModel5);
  TestModel7.belongsToMany(TestModel6, {through: 'TestModel6TestModel7'});
  const testModel6TestModel7Association = TestModel6.belongsToMany(TestModel7, {through: 'TestModel6TestModel7'});
  const TestModel9 = nameStringValueString('TestModel9', database.sequelize, database.Sequelize);
  const TestModel10 = nameStringValueString('TestModel10', database.sequelize, database.Sequelize);
  const TestModel11 = nameStringValueString('TestModel11', database.sequelize, database.Sequelize);
  const TestModel12 = nameStringValueString('TestModel12', database.sequelize, database.Sequelize);
  TestModel10.belongsToMany(TestModel9, {through: 'TestModel9TestModel10'});
  const testModel9TestModel10Association = TestModel9.belongsToMany(TestModel10, {through: 'TestModel9TestModel10'});
  TestModel10.hasMany(TestModel12);
  TestModel11.belongsTo(TestModel9);
  TestModel9.hasOne(TestModel11);
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
  const AliasChildBelongsToManyIncludeTest =
    nameStringValueString('AliasChildBelongsToManyIncludeTest', database.sequelize, database.Sequelize);
  AliasChildBelongsToManyIncludeTest.belongsToMany(AliasChildBelongsToMany, {through: 'AliasChildBelongsToManyIncludeTestThrough'});
  AliasChildBelongsToMany.belongsToMany(AliasChildBelongsToManyIncludeTest, {through: 'AliasChildBelongsToManyIncludeTestThrough'});

  const AliasChildBelongsToManyNestedIncludeTest =
    nameStringValueString('AliasChildBelongsToManyNestedIncludeTest', database.sequelize, database.Sequelize);
  AliasChildBelongsToManyIncludeTest
    .belongsToMany(AliasChildBelongsToManyNestedIncludeTest, {through: 'AliasChildBelongsToManyNestedIncludeTestThrough'});
  AliasChildBelongsToManyNestedIncludeTest
    .belongsToMany(AliasChildBelongsToManyIncludeTest, {through: 'AliasChildBelongsToManyNestedIncludeTestThrough'});

  const StringAliasParentBelongsToMany = valueString('StringAliasParentBelongsToMany', database.sequelize, database.Sequelize);
  const StringAliasChildBelongsToMany = nameStringValueString('StringAliasChildBelongsToMany', database.sequelize, database.Sequelize);
  const stringAliasParentBelongsToManyAliasChildBelongsToManyAssociation =
    StringAliasParentBelongsToMany.belongsToMany(StringAliasChildBelongsToMany,
      {through: 'StringAliasBelongsToMany', as: 'Children'});

  const AllRelationsSource1 = database.sequelize.define('AllRelationsSource1', {});
  const AllRelationsTarget1 = database.sequelize.define('AllRelationsTarget1', {name: database.Sequelize.STRING});
  const AllRelationsSource2 = database.sequelize.define('AllRelationsSource2', {});
  const AllRelationsTarget2 = database.sequelize.define('AllRelationsTarget2', {});
  AllRelationsSource1.hasOne(AllRelationsTarget1);
  AllRelationsSource1.hasMany(AllRelationsTarget1);
  AllRelationsSource2.belongsTo(AllRelationsTarget2);
  AllRelationsSource2.belongsToMany(AllRelationsTarget2, {through: 'test'});
  const UUIDTestModel = uuidTestModel('UUIDTestModel', database.sequelize, database.Sequelize);
  [
    TestModel,
    TestModel2,
    TestModel3,
    TestModel4,
    TestModel5,
    TestModel6,
    TestModel7,
    TestModel8,
    TestModel9,
    TestModel10,
    TestModel11,
    TestModel12,
    AuthorizationAssocChild,
    AuthorizationAssocParent,
    AuthorizationAssocParent2,
    lowerCaseModel,
    anotherLowercaseModel,
    AliasParent,
    AliasChild,
    AliasParentBelongsToMany,
    AliasChildBelongsToMany,
    AliasChildBelongsToManyIncludeTest,
    AliasChildBelongsToManyNestedIncludeTest,
    StringAliasParentBelongsToMany,
    StringAliasChildBelongsToMany,
    AllRelationsSource1,
    AllRelationsTarget1,
    AllRelationsSource2,
    AllRelationsTarget2,
    TestModelVirtualFields
  ].forEach(modelExtension);

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
      const apiData = exseq([
        {model: TestModel, opts: {}},
        {model: TestModel2, opts: {}},
        {model: TestModel4, opts: {}},
        {model: TestModel5, opts: {}},
        {model: TestModel6, opts: {}},
        {model: TestModel7, opts: {}},
        {model: TestModel8, opts: {}},
        {model: TestModel9, opts: {}},
        {model: TestModel10, opts: {}},
        {model: TestModel11, opts: {}},
        {model: TestModel12, opts: {}},
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
        {model: AliasChildBelongsToMany, opts: {}},
        {model: AliasChildBelongsToManyIncludeTest, opts: {}},
        {model: AliasChildBelongsToManyNestedIncludeTest, opts: {}},
        {model: StringAliasParentBelongsToMany, opts: {}},
        {model: StringAliasChildBelongsToMany, opts: {}},
        {model: AllRelationsSource1, opts: {}},
        {model: AllRelationsTarget1, opts: {}},
        {model: TestModelVirtualFields, opts: {}}
      ], {
        dataMapper: database.Sequelize
      });

      apiData.routingInformation.forEach((routing) => {
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
        // console.error(err);
        if (!err.status) {
          return res.status(500).send({message: err.stack});
        }
        return res.status(err.status).send({message: err.result});
      });
      done();
    });

    beforeEach(async () => {
      await database.init();
      for (let i = 0; i < 49; i++) {
        const testModel = await TestModel.create({value1: 'test' + i, value2: i, value3: 'no null!'});
        const testModel2 = await TestModel2.create({});
        await testModel2.setTestModel(testModel);
        const testModel3 = await TestModel3.create({value1: 'test' + i, value2: 3});
        await testModel.setTestModel3(testModel3);
      }
      for (let i = 0; i < 2; i++) {
        const testModel9 = await TestModel9.create({name: 'BelongsToMany-parent1', value: 'BelongsToMany-value-parent1'});

        // create belongs to instances
        const testModel11 = await TestModel11.create({name: 'supername', value: 'supervalue'});
        await testModel11.setTestModel9(testModel9);

        // create belongs to many instances
        const testModel10One =
          await TestModel10.create({name: 'BelongsToMany-child1', value: 'BelongsToMany-value-child1'});
        const testModel10Two =
          await TestModel10.create({name: 'BelongsToMany-child2', value: 'BelongsToMany-value-child2'});
        const testModel10Three =
          await TestModel10.create({name: 'BelongsToMany-child3', value: 'BelongsToMany-value-child3'});
        await testModel10One.createTestModel12({name: 'HasMany-child1', value: 'HasMany-value-child1'});
        await testModel10Two.createTestModel12({name: 'HasMany-child1', value: 'HasMany-value-child1'});
        await testModel10Three.createTestModel12({name: 'HasMany-child1', value: 'HasMany-value-child1'});
        await testModel9.addTestModel10(testModel10One);
        await testModel9.addTestModel10(testModel10Two);
        await testModel9.addTestModel10(testModel10Three);
      }
      await TestModel2.create({name: 'addrelationTestModel2'});
      await TestModel.create({value1: 'addrelationTestModel', value2: 1, value3: 'no null!'});

      const testModel4 = await TestModel4.create({name: 'HasMany-parent1'});

      const testModel5One = await TestModel5.create({name: 'HasMany-child1', value: 'HasMany-value-child1'});
      const testModel5Two = await TestModel5.create({name: 'HasMany-child2', value: 'HasMany-value-child2'});
      const testModel5Three = await TestModel5.create({name: 'HasMany-child3', value: 'HasMany-value-child3'});

      await testModel4.addTestModel5(testModel5One);
      await testModel4.addTestModel5(testModel5Two);
      await testModel4.addTestModel5(testModel5Three);

      const testModel6 = await TestModel6.create({name: 'BelongsToMany-parent1'});

      const testModel7One = await TestModel7.create({name: 'BelongsToMany-child1', value: 'BelongsToMany-value-child1'});
      const testModel7Two = await TestModel7.create({name: 'BelongsToMany-child2', value: 'BelongsToMany-value-child2'});
      const testModel7Three = await TestModel7.create({name: 'BelongsToMany-child3', value: 'BelongsToMany-value-child3'});

      await testModel6.addTestModel7(testModel7One);
      await testModel6.addTestModel7(testModel7Two);
      await testModel6.addTestModel7(testModel7Three);

      const aliasParentBelongsToMany = await AliasParentBelongsToMany.create({name: 'BelongsToMany-parent1'});

      const aliasChildBelongsToManyOne = await AliasChildBelongsToMany
        .create({name: 'BelongsToMany-child1', value: 'BelongsToMany-value-child1'});
      const aliasChildBelongsToManyTwo = await AliasChildBelongsToMany
        .create({name: 'BelongsToMany-child2', value: 'BelongsToMany-value-child2'});
      const aliasChildBelongsToManyThree = await AliasChildBelongsToMany
        .create({name: 'BelongsToMany-child3', value: 'BelongsToMany-value-child3'});
      for (let i = 0; i < 10; i++) {
        const includeTest = await AliasChildBelongsToManyIncludeTest.create({name: `AliasChildBelongsToManyIncludeTest-${i}`, value: `value-${i}`});
        await aliasChildBelongsToManyOne.addAliasChildBelongsToManyIncludeTest(includeTest);
        for (let j = 0; j < 10; j++) {
          await includeTest.addAliasChildBelongsToManyNestedIncludeTest(await AliasChildBelongsToManyNestedIncludeTest.create({name: `AliasChildBelongsToManyNestedIncludeTest-${j}`, value: `value-${j}`}));
        }
      }
      for (let i = 0; i < 5; i++) {
        const includeTest = await AliasChildBelongsToManyIncludeTest.create({name: `AliasChildBelongsToManyIncludeTest-${i}`, value: `value-${i}`});
        await aliasChildBelongsToManyTwo.addAliasChildBelongsToManyIncludeTest(includeTest);
        for (let j = 0; j < 10; j++) {
          await includeTest.addAliasChildBelongsToManyNestedIncludeTest(await AliasChildBelongsToManyNestedIncludeTest.create({name: `AliasChildBelongsToManyNestedIncludeTest-${j}`, value: `value-${j}`}));
        }
      }
      await aliasParentBelongsToMany.addChild(aliasChildBelongsToManyOne);
      await aliasParentBelongsToMany.addChild(aliasChildBelongsToManyTwo);
      await aliasParentBelongsToMany.addChild(aliasChildBelongsToManyThree);

      const stringAliasParentBelongsToMany = await StringAliasParentBelongsToMany.create({name: 'BelongsToMany-parent1'});

      const stringAliasChildBelongsToManyOne = await StringAliasChildBelongsToMany.
        create({name: 'BelongsToMany-child1', value: 'BelongsToMany-value-child1'});
      const stringAliasChildBelongsToManyTwo = await StringAliasChildBelongsToMany
        .create({name: 'BelongsToMany-child2', value: 'BelongsToMany-value-child2'});
      const stringAliasChildBelongsToManyThree = await StringAliasChildBelongsToMany
        .create({name: 'BelongsToMany-child3', value: 'BelongsToMany-value-child3'});

      await stringAliasParentBelongsToMany.addChild(stringAliasChildBelongsToManyOne);
      await stringAliasParentBelongsToMany.addChild(stringAliasChildBelongsToManyTwo);
      await stringAliasParentBelongsToMany.addChild(stringAliasChildBelongsToManyThree);

      const lowerCaseModelInstance = await lowerCaseModel.create({name: 'lowercase-belongsto'});
      const anotherLowercaseModelInstance = await anotherLowercaseModel
        .create({name: 'anotherlowercase-belongsto', value: 'anotherlowercase-belongsto-value'});
      await lowerCaseModelInstance.setAnotherLowercaseModel(anotherLowercaseModelInstance);

      const aliasParentInstance = await AliasParent.create({name: 'HasMany-parent1'});

      const aliasChildOne = await AliasChild.create({name: 'HasMany-child1', value: 'HasMany-value-child1'});
      const aliasChildTwo = await AliasChild.create({name: 'HasMany-child2', value: 'HasMany-value-child2'});
      const aliasChildThree = await AliasChild.create({name: 'HasMany-child3', value: 'HasMany-value-child3'});

      await aliasParentInstance.addChild(aliasChildOne);
      await aliasParentInstance.addChild(aliasChildTwo);
      await aliasParentInstance.addChild(aliasChildThree);
    });

    afterEach(async () => {
      await database.reset();
    });

    describe('Middleware', () => {
      describe('associationMiddleware', () => {
        it('should respect config settings', () => {
          const middleware = associationMiddleware([TestModel], {
            fieldName: 'test'
          });
          const toTest = {};
          middleware(toTest, {}, () => {});
          expect(toTest['test']).to.not.be.null;
        });
        it('should use a default name if no fieldName was specified', () => {
          const middleware = associationMiddleware([TestModel]);
          const toTest = {};
          middleware(toTest, {}, () => {});
          expect(toTest['associationInformation']).to.not.be.null;
        });
      });
    });
    describe('Model', () => {
      describe('getModelAssociations - CAREFUL THESE TEST WILL HANG IF EXPECT FAILS! - CHAI', () => {
        const HasOneSource = database.sequelize.define('HasOneSource', {});
        const HasOneTarget = database.sequelize.define('HasOneTarget', {});

        const HasManySource = database.sequelize.define('HasManySource', {});
        const HasManyTarget = database.sequelize.define('HasManyTarget', {});

        const BelongsToSource = database.sequelize.define('BelongsToSource', {});
        const BelongsToTarget = database.sequelize.define('BelongsToTarget', {});

        const BelongsToManySource = database.sequelize.define('BelongsToManySource', {});
        const BelongsToManyTarget = database.sequelize.define('BelongsToManyTarget', {});
        const BelongsToManyThrough = database.sequelize.define('BelongsToManyThrough', {});

        const MultiSource = database.sequelize.define('MultiSource', {});
        const MultiSourceThrough = database.sequelize.define('MultiSourceThrough', {});

        HasOneSource.hasOne(HasOneTarget);
        HasManySource.hasMany(HasManyTarget);
        BelongsToSource.belongsTo(BelongsToTarget);
        BelongsToManySource.belongsToMany(BelongsToManyTarget, {through: BelongsToManyThrough});

        MultiSource.hasOne(HasOneTarget);
        MultiSource.hasMany(HasManyTarget);
        MultiSource.belongsTo(BelongsToTarget);
        MultiSource.belongsToMany(BelongsToManyTarget, {through: MultiSourceThrough});

        const CustomFKSource = database.sequelize.define('CustomFKSource', {});
        const CustomFKTarget = database.sequelize.define('CustomFKTarget', {});
        CustomFKSource.hasOne(CustomFKTarget, {as: 'target', foreignKey: 'target_id'});

        const models = [
          HasOneSource, HasOneTarget,
          HasManySource, HasManyTarget,
          BelongsToSource, BelongsToTarget,
          BelongsToManySource, BelongsToManyTarget,
          MultiSource,
          CustomFKSource, CustomFKTarget
        ];
        models.forEach(m => {
          modelExtension(m);
        });

        it('should return a list of all relationships, include the foreign key fields of a model', () => {
          expect(MultiSource.getModelAssociations()).to.deep.equal([{
            source: MultiSource,
            target: HasOneTarget,
            associationType: 'HasOne',
            fk: 'MultiSourceId',
            as: 'HasOneTarget'
          },
          {
            source: MultiSource,
            target: HasManyTarget,
            associationType: 'HasMany',
            fk: 'MultiSourceId',
            as: 'HasManyTargets'
          },
          {
            source: MultiSource,
            target: BelongsToTarget,
            associationType: 'BelongsTo',
            fk: 'BelongsToTargetId',
            as: 'BelongsToTarget'
          },
          {
            source: MultiSource,
            target: BelongsToManyTarget,
            associationType: 'BelongsToMany',
            through: MultiSourceThrough,
            sourceFk: 'MultiSourceId',
            targetFk: 'BelongsToManyTargetId',
            as: 'BelongsToManyTargets'
          }]);
          expect(HasOneSource.getModelAssociations()).to.deep.equal(
            [{
              source: HasOneSource,
              target: HasOneTarget,
              associationType: 'HasOne',
              fk: 'HasOneSourceId',
              as: 'HasOneTarget'
            }]
          );
          expect(HasManySource.getModelAssociations()).to.deep.equal(
            [{
              source: HasManySource,
              target: HasManyTarget,
              associationType: 'HasMany',
              fk: 'HasManySourceId',
              as: 'HasManyTargets'
            }]
          );
          expect(BelongsToSource.getModelAssociations()).to.deep.equal(
            [{
              source: BelongsToSource,
              target: BelongsToTarget,
              associationType: 'BelongsTo',
              fk: 'BelongsToTargetId',
              as: 'BelongsToTarget'
            }]
          );

          expect(BelongsToManySource.getModelAssociations()).to.deep.equal(
            [{
              source: BelongsToManySource,
              target: BelongsToManyTarget,
              associationType: 'BelongsToMany',
              through: BelongsToManyThrough,
              sourceFk: 'BelongsToManySourceId',
              targetFk: 'BelongsToManyTargetId',
              as: 'BelongsToManyTargets'
            }]
          );
        });
        it('should be able to handle custom foreign keys', () => {
          expect(CustomFKSource.getModelAssociations()[0].fk).to.equal('target_id');
        });
        describe('AssociationInformation', () => {
          it('should check check for null models', () => {
            try {
              new AssociationInformation(null);
            } catch (err) {
              expect(err.message).to.equal('no models provided.');
            }
          });
          describe('createAssociationInformation', () => {
            const associationInformation = new AssociationInformation(models);
            associationInformation.createAssociationInformation();
            it('should create a lookup table that maps all models to their respective association.', () => {
              expect(associationInformation.getAssociationInformation(HasOneTarget)).to.deep.equal(
                [{
                  source: HasOneSource,
                  target: HasOneTarget,
                  associationType: 'HasOne',
                  fk: 'HasOneSourceId',
                  as: 'HasOneTarget'
                },
                {
                  source: MultiSource,
                  target: HasOneTarget,
                  associationType: 'HasOne',
                  fk: 'MultiSourceId',
                  as: 'HasOneTarget'
                }]
              );
              expect(associationInformation.getAssociationInformation(CustomFKTarget)).to.deep.equal(
                [{
                  source: CustomFKSource,
                  target: CustomFKTarget,
                  associationType: 'HasOne',
                  fk: 'target_id',
                  as: 'target'
                }]
              );
            });
            it('should check for invalid models', () => {
              const associationInformation = new AssociationInformation([{}]);
              expect(associationInformation.createAssociationInformation.bind(associationInformation)).to.throw('invalid model');
            });
          });
          describe('getAssociationInformation', () => {
            it('should throw an error if the association information was not created yet', () => {
              const associationInformation = new AssociationInformation(models);
              expect(associationInformation.getAssociationInformation.bind(associationInformation, HasOneTarget))
                .to.throw('association information not initialized!');
            });
            it('should allow foreign key lookups', () => {
              const associationInformation = new AssociationInformation(models);
              associationInformation.createAssociationInformation();
              expect(associationInformation.getAssociationInformation('HasOneSourceId')[0]).to.deep.equal({
                source: HasOneSource,
                target: HasOneTarget,
                associationType: 'HasOne',
                fk: 'HasOneSourceId',
                as: 'HasOneTarget'
              });
              expect(associationInformation.getAssociationInformation('MultiSourceId')).to.have.lengthOf(3);
              expect(associationInformation.getAssociationInformation('BelongsToManyTargetId')).to.have.lengthOf(2);
            });
          });
        });
      });
      describe('getAssociationByModel', () => {
        it('should be able to handle normal plurals', () => {
          expect(TestModel4.getAssociationByModel(TestModel5)).to.equal(testModel4Testmodel5Association);
        });
        it('should be able to handle irregular plurals', () => {
          expect(AliasParent.getAssociationByModel(AliasChild)).to.equal(aliasParentAliasChildAssociation);
        });
      });
      describe('getUpdateableAttributes', () => {
        const M1 = database.sequelize.define('M1', {x: {allowNull: true, type: database.Sequelize.STRING}});
        const M2 = database.sequelize.define('M2', {x: {allowNull: false, type: database.Sequelize.STRING}});
        M1.hasMany(M2);
        modelExtension(M1);
        modelExtension(M2);
        it('should return a list of all attributes, without fields that are managed by the ORM or the database.', () => {
          expect(M1.getUpdateableAttributes()).to.deep.equal([
            {attribute: 'x', allowNull: true}
          ]);
        });
        it('should not strip attributes that are relevant for relations', () => {
          expect(M2.getUpdateableAttributes().filter(attr => attr.attribute === 'M1Id')).to.have.lengthOf(1);
        });
      });
      describe('removeIllegalAttributes', () => {
        it('should remove illegal arguments.', () => {
          expect(TestModel.removeIllegalAttributes({this: 1, is: 1, a: 1, test: 1})).to.deep.equal({});
        });
        it('should retain legal arguments.', () => {
          expect(TestModel.removeIllegalAttributes({this: 1, is: 1, a: 1, test: 1, value1: 'should stay'}))
            .to.deep.equal({value1: 'should stay'});
        });
      });
      describe('fillMissingUpdateableAttributes', () => {
        it('should fill up missing model members with null.', () => {
          expect(TestModel.fillMissingUpdateableAttributes(null, null, {})).to.deep.equal({
            value1: null,
            value2: null,
            value3: null
          });
        });
        it('should not overwrite existing members.', () => {
          expect(TestModel.fillMissingUpdateableAttributes(null, null, {value1: 'test'})).to.deep.equal({
            value1: 'test',
            value2: null,
            value3: null
          });
        });
      });
    });

    describe('exseq', () => {
      it('should not allow registering the same model twice.', () => {
        expect(exseq
          .bind(null, [{model: TestModel}, {model: TestModel}], {dataMapper: database.Sequelize})).to.throw('already registered');
      });
      it('should check that models are set', () => {
        expect(exseq.bind(null, null, {dataMapper: database.Sequelize})).to.throw('models must be set!');
      });
      it('should check if the supplied models instance is an array', () => {
        expect(exseq.bind(null, {}, {dataMapper: database.Sequelize})).to.throw('models must be an array');
      });
      describe('opts', () => {
        describe('middleware', () => {
          describe('associationMiddleware', () => {
            const exseqResult = exseq([{model: TestModel}], {
              dataMapper: database.Sequelize,
              middleware: {
                associationMiddleware: true
              }
            }).routingInformation;
            function getAssocMiddleware(routingInformation) {
              return routingInformation.router.stack.filter((layer) => {
                return layer && layer.handle && layer.handle.name === 'associationMiddleware';
              });
            }
            it('should enable the middleware if specified', () => {
              exseqResult.forEach(routingInformation => {
                expect(getAssocMiddleware(routingInformation)).to.have.lengthOf(1);
              });
            });
            it('should attach AssociationInformation to the req object', () => {
              exseqResult.forEach(routingInformation => {
                const middleware = getAssocMiddleware(routingInformation)[0].handle;
                const toCheck = {};
                middleware(toCheck, null, () => {});
                expect(toCheck['associationInformation']).to.exist;
              });
            });
          });
        });
        describe('opts.dataMapper', () => {
          it('should require opts.dataMapper to be set', () => {
            expect(exseq.bind(null)).to.throw('you must pass a data mapper using opts.dataMapper');
          });
        });
        describe('opts.idRegex', () => {
          it('should support id regex specification', async () => {
            const instance = await UUIDTestModel.create();
            const apiData = exseq([
              {
                model: UUIDTestModel
              }
            ], {
              idRegex: '[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}',
              dataMapper: database.Sequelize
            });
            const app2 = express();

            apiData.routingInformation.forEach((routing) => {
              app2.use(routing.route, routing.router);
            });

            app2.use((req, res, next) => {
              if (res.__payload) {
                return res.status(res.__payload.status).send({
                  result: res.__payload.result, message: res.__payload.message
                });
              }
              res.status(404).send();
            });

            return request(app2)
              .get(`/UUIDTestModel/${instance.id}`)
              .expect(200);
          });
        });
        describe('opts.route', () => {
          it('should make the camel cased route name a dashed string.', () => {
            expect(exseq([
              {
                model: TestModel,
                opts: {}
              }
            ], {
              dataMapper: database.Sequelize,
              naming: function (v) { return v.replace(/([a-zA-Z])(?=[A-Z])/g, '$1-').toLowerCase(); }
            }).routingInformation[0].route).to.equal('/test-model');
          });
          it('should not change a custom route name.', () => {
            expect(exseq([
              {
                model: TestModel,
                opts: {route: 'UseThis'}
              }
            ], {
              dataMapper: database.Sequelize,
              naming: function (v) { return v.replace(/([a-zA-Z])(?=[A-Z])/g, '$1-').toLowerCase(); }
            }).routingInformation[0].route).to.equal('/UseThis');
          });
        });
      });
      describe('model.opts', () => {
        describe('opts.route', () => {
          it('should allow setting a custom route name.', () => {
            expect(exseq([
              {
                model: TestModel,
                opts: {route: 'UseThis'}
              }
            ], {
              dataMapper: database.Sequelize
            }).routingInformation[0].route).to.equal('/UseThis');
          });
          it('should check if the custom route name has already been registered.', () => {
            expect(exseq.bind(null, [
              {
                model: TestModel2,
                opts: {route: 'UseThis'}
              },
              {
                model: TestModel,
                opts: {route: 'UseThis'}
              }
            ], {
              dataMapper: database.Sequelize
            })).to.throw('already registered');
          });
        });
        describe('models.opts.authorizeWith', () => {
          it('should not allow illegal auth types.', () => {
            expect(_getAuthorizationMiddleWare.bind(null, [{model: TestModel, opts: {}}], TestModel, null, 'FOO')).to.throw();
            expect(_getAuthorizationMiddleWare.bind(null, [{model: TestModel, opts: {}}], TestModel, null, 'BAR')).to.throw();
          });
          it('should allow legal auth types.', () => {
            expect(_getAuthorizationMiddleWare.bind(null, [{model: TestModel, opts: {}}], TestModel, null, 'CREATE')).not.to.throw();
            expect(_getAuthorizationMiddleWare
              .bind(null, [{model: TestModel, opts: {}}], TestModel, null, 'UPDATE_PARTIAL')).not.to.throw();
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
          describe('model.opts.authorizeWith.useParentForAuthorization', () => {
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
          describe('model.opts.authorizeWith.authorizeForChildren', () => {
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

    describe('_createReplyObject', () => {
      it('should handle a single object', async () => {
        const input = await TestModel.findOne();
        expect(_createReplyObject(true, input)).not.to.be.an('array');
      });
      it('should handle a an array of objects', async () => {
        const input = await TestModel.findAll();
        expect(_createReplyObject(true, input)).to.be.an('array');
      });
      it('should return raw data', async () => {
        const input = await TestModel.findOne();
        expect(_createReplyObject(true, input).dataValues).to.not.exist;
      });
      it('should return a sequelize instance', async () => {
        const input = await TestModel.findOne();
        expect(_createReplyObject(false, input).dataValues).to.exist;
      });
      it('should be fault tolerant and not crash if .get() is unavailable', () => {
        expect(_createReplyObject.bind(null, true, {})).not.to.throw();
      });
    });

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

    describe('/model POST', () => {
      it('should create an instance.', async () => {
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

      it('should allow the creation of an instance and linking it to its owner (association) via the foreignkey in the request body',
        async () => {
          const owner = await AllRelationsSource1.create({});
          const response = await request(app)
            .post('/AllRelationsTarget1')
            .send({AllRelationsSource1Id: owner.id, name: 'assoc by fk test!'})
            .expect(201);
          const owned = await owner.getAllRelationsTarget1();
          expect(owned.name).to.equal('assoc by fk test!');
          expect(owned.AllRelationsSource1Id).to.equal(1);
        });
    });

    describe('/model/search POST', async () => {
      it('should throw an error if no search query has been given', async () => {
        await request(app)
          .post('/TestModel/search')
          .send({i: 4, p: 0})
          .expect(400);
      });
      it('should accept 0 as a valid value for p', () => {
        return request(app)
          .post('/TestModel/search')
          .send({i: 4, p: 0, s: {value1: {'like': 'test%'}}})
          .expect(200)
          .then(response => {
            expect(response.body.result).to.have.lengthOf(4);
          });
      });
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
          .send({s: {value1: {'like': 'test%'}}})
          .expect(200)
          .then(response => {
            expect(response.header['x-total-count']).to.equal('49');
            expect(response.body.result.length).to.equal(10);
          });
      });
      it('should find instance that match the search query with include', () => {
        return request(app)
          .post('/TestModel6/search')
          .send({
            s: {
              include: [{
                model: 'TestModel7',
                where: {
                  '$or': [{
                    name: {
                      like: '%child1%'
                    }
                  }]
                }
              }]
            }
          })
          .expect(200)
          .then(response => {
            expect(response.header['x-total-count']).to.equal('1');
            expect(response.body.result.length).to.equal(1);

            const testModel6Id = response.body.result[0].id;
            const testModel7Id = response.body.result[0].TestModel7s[0].id;
            const testModel6TestModel7TestModel6Id = response.body.result[0].TestModel7s[0].TestModel6TestModel7.TestModel6Id;
            const testModel6TestModel7TestModel7Id = response.body.result[0].TestModel7s[0].TestModel6TestModel7.TestModel7Id;

            expect(testModel6Id).to.equal(testModel6TestModel7TestModel6Id);
            expect(testModel7Id).to.equal(testModel6TestModel7TestModel7Id);
          });
      });
      it('should find instance that match the search query with include 2', async () => {
        return request(app)
          .post('/TestModel9/search')
          .send({
            s: {
              name: {
                'like': '%parent1%'
              },
              include: [
                {
                  model: 'TestModel10',
                  where: {
                    'or': [
                      {
                        name: {
                          'like': '%child%'
                        }
                      }
                    ]
                  }
                },
                {
                  model: 'TestModel11',
                  where: {
                    'or': [
                      {
                        name: {
                          'like': '%supername%'
                        }
                      }
                    ]
                  }
                }
              ]
            }
          })
          .expect(200);
      });
      it('should throw an error if a non-existent model is passed as an include', async () => {
        return request(app)
          .post('/TestModel9/search')
          .send({
            s: {
              name: {
                'like': '%name1%'
              },
              include: [
                {
                  model: 'TestModel14', // non-existent model
                  where: {
                    'or': [
                      {
                        name: {
                          'like': '%child%'
                        }
                      }
                    ]
                  }
                },
                {
                  model: 'TestModel11',
                  where: {
                    'or': [
                      {
                        name: {
                          'like': '%supername%'
                        }
                      }
                    ]
                  }
                }
              ]
            }
          })
          .expect(404)
          .then(response => {
            expect(response.body.message).to.equal('unable to resolve model TestModel14');
          });
      });
      it('should find instance that match the search query with nested include', async () => {
        return request(app)
          .post('/TestModel9/search')
          .send({
            s: {
              name: {
                '$like': '%parent1%'
              },
              include: [
                {
                  model: 'TestModel10',
                  where: {
                    '$or': [
                      {
                        name: {
                          '$like': '%child%'
                        }
                      }
                    ]
                  },
                  include: [
                    {
                      model: 'TestModel12',
                      where: {
                        '$or': [
                          {
                            name: {
                              '$like': '%child%'
                            }
                          }
                        ]
                      }
                    }
                  ]
                },
                {
                  model: 'TestModel11',
                  where: {
                    '$or': [
                      {
                        name: {
                          '$like': '%supername%'
                        }
                      }
                    ]
                  }
                }
              ]
            }
          })
          .expect(200);
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
      it('should accept 0 as a valid value for p', () => {
        return request(app)
          .get('/TestModel?i=4&p=0')
          .expect(200)
          .then(response => {
            expect(response.body.result).to.have.lengthOf(4);
          });
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
      it('should return 404 if the entity was not found.', async () => {
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
      it('should allow updating of an instance and linking it to an owner (association) via the foreignkey in the request body',
        async () => {
          const owner = await AllRelationsSource1.create({});
          const owner2 = await AllRelationsSource1.create({});
          const owned = await AllRelationsTarget1.create({AllRelationsSource1Id: owner.id, name: 'assoc by fk test!'});
          await request(app)
            .put(`/AllRelationsTarget1/${owned.id}`)
            .send({AllRelationsSource1Id: owner2.id, name: 'updated: assoc by fk test!'})
            .expect(204);
          const changedOwned = await owner2.getAllRelationsTarget1();
          expect(changedOwned).not.to.be.null;
          expect(changedOwned.name).to.equal('updated: assoc by fk test!');
          expect(changedOwned.AllRelationsSource1Id).to.equal(2);
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
      ['get', 'post', 'put', 'patch', 'delete'].forEach(verb => {
        it(`should inform callers that the source does not exist: ${verb}.`, () => {
          return request(app)[verb]('/TestModel2/1000/TestModel/')
            .expect(404)
            .then(response => {
              expect(response.body.message).to.equal('source not found.');
            });
        });
      });
      // DELETE and POST are special, POST creates a target and DELETE unsets a target
      ['get', 'put', 'patch'].forEach(verb => {
        it(`should inform callers that the target does not exist: ${verb}.`, async () => {
          const testModel2Instance = await TestModel2.findOne({where: {name: 'addrelationTestModel2'}});
          const response = await request(app)[verb](`/TestModel2/${testModel2Instance.id}/TestModel/`).expect(404);
          expect(response.body.message).to.equal('target not found.');
        });
      });
      it('should only show attributes that have been specified.', async () => {
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
            expect(response.body.result.id).to.equal(5);
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
            return TestModel2.findByPk(5).then(testModel2Instance => {
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
          .send({value1: 'changed1', value2: 10})
          .expect(204)
          .then(response => {
            return TestModel2.findByPk(5).then(testModel2Instance => {
              return testModel2Instance.getTestModel().then(testModelInstance => {
                const plainInstance = testModelInstance.get({plain: true});
                expect(plainInstance.value1).to.equal('changed1');
                expect(plainInstance.value2).to.equal(10);
                expect(plainInstance.value3).to.equal('no null!');
              });
            });
          });
      });
    });
    describe('/model/:id/belongsToRelation/ DELETE', () => {
      it('should delete the belongsTo relation of the resource', async () => {
        return request(app)
          .delete('/TestModel2/5/TestModel/')
          .expect(204)
          .then(response => {
            return TestModel2.findByPk(5).then(testModel2Instance => {
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
            return TestModel.findByPk(5).then(testModelInstance => {
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
      it('should update individual attributes of the hasOne relation of the resource', async () => {
        return request(app)
          .patch('/TestModel/5/TestModel3/')
          .send({value1: 'changed'})
          .expect(204)
          .then(response => {
            return TestModel.findByPk(5).then(testModelInstance => {
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
            return TestModel.findByPk(5).then(testModelInstance => {
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
        {
          source: TestModel9, sourceName: 'TestModel9', target: TestModel10,
          association: testModel9TestModel10Association, associationName: 'TestModel10'
        },
        // test proper aliasing and pluralization
        {
          source: AliasParent, sourceName: 'AliasParent', target: AliasChild,
          association: aliasParentAliasChildAssociation, associationName: 'Child', searchFor: 'HasMany-child1'
        },
        {
          source: AliasParentBelongsToMany, sourceName: 'AliasParentBelongsToMany', target: AliasChildBelongsToMany,
          association: aliasParentBelongsToManyAliasChildBelongsToManyAssociation,
          associationName: 'Child', searchFor: 'BelongsToMany-child1'
        },
        {
          source: StringAliasParentBelongsToMany,
          sourceName: 'StringAliasParentBelongsToMany',
          target: StringAliasChildBelongsToMany,
          association: stringAliasParentBelongsToManyAliasChildBelongsToManyAssociation,
          associationName: 'Child',
          searchFor: 'BelongsToMany-child1'
        }
      ].forEach(manyRelation => {
        if (manyRelation.source !== AliasParentBelongsToMany) {
          it('must meet preconditions.', () => {
            expect(manyRelation.source.name).to.equal(manyRelation.sourceName);
            expect(manyRelation.association.options.name.singular).to.equal(manyRelation.associationName);
          });
          describe(`/model/:id/${manyRelation.association.associationType}/ GET`, () => {
            it(`should return the ${manyRelation.association.associationType} relations of the requested resource.`, async () => {
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
                  // test model 9 is a special case with 6 instances
                  if (manyRelation.source.name === 'TestModel9') {
                    expect(response.body.result).to.equal(6);
                  } else {
                    expect(response.body.result).to.equal(3);
                  }
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
            it('should only show attributes that have been specified.', async () => {
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
            it('should return 404 if the source was not found', async () => {
              return request(app)
                .get(`/${manyRelation.source.name}/1000/${manyRelation.association.options.name.singular}/2`)
                .expect(404)
                .then(response => {
                  expect(response.body).to.deep.equal({
                    message: 'source not found.'
                  });
                });
            });
            it('should return 404 if the target was not found', async () => {
              return request(app)
                .get(`/${manyRelation.source.name}/1/${manyRelation.association.options.name.singular}/1000`)
                .expect(404)
                .then(response => {
                  expect(response.body).to.deep.equal({
                    message: 'target not found.'
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
            if (manyRelation.association.associationType === 'BelongsToMany') {
              it('should link an item to the BelongsToMany.', async () => {
                const sourceInstance = await manyRelation.source.findOne({where: {name: `${manyRelation.association.associationType}-parent1`}});
                const targetInstance = await manyRelation.target.create({name: `${manyRelation.association.associationType}-child4`});

                const {status} = await request(app).post(`/${manyRelation.source.name}/${sourceInstance.get({plain: true}).id}/${manyRelation.association.options.name.singular}/${targetInstance.get({play: true}).id}/link`);
                expect(status).to.equal(204);

                const isLinked = await sourceInstance[manyRelation.association.accessors.hasSingle](targetInstance);
                expect(isLinked).to.be.true;
              });
              it('should unlink an item from the BelongsToMany.', async () => {
                const sourceInstance = await manyRelation.source.findOne({where: {name: `${manyRelation.association.associationType}-parent1`}});
                const targetInstance = await manyRelation.target.create({name: `${manyRelation.association.associationType}-child4`});

                const {status: createStatus} = await request(app).post(`/${manyRelation.source.name}/${sourceInstance.get({plain: true}).id}/${manyRelation.association.options.name.singular}/${targetInstance.get({play: true}).id}/link`);
                expect(createStatus).to.equal(204);

                const isLinked = await sourceInstance[manyRelation.association.accessors.hasSingle](targetInstance);
                expect(isLinked).to.be.true;

                const {status: deleteStatus} = await request(app).delete(`/${manyRelation.source.name}/${sourceInstance.get({plain: true}).id}/${manyRelation.association.options.name.singular}/${targetInstance.get({play: true}).id}/unlink`);
                expect(deleteStatus).to.equal(204);

                const isLinkedAfterDelete = await sourceInstance[manyRelation.association.accessors.hasSingle](targetInstance);
                expect(isLinkedAfterDelete).to.be.false;
              });
            }
            it('should return a 404 if the source that should be used to create a target does not exist.', async () => {
              return request(app)
                .post(`/${manyRelation.source.name}/1000/${manyRelation.association.options.name.singular}/`)
                .expect(404)
                .then(response => {
                  expect(response.body).to.deep.equal({
                    message: 'source not found.'
                  });
                });
            });
          });
          describe('/model/:id/hasManyRelation/ PUT', () => {
            it(`should update a ${manyRelation.association.associationType} relation of the resource`, async () => {
              return request(app)
                .put(`/${manyRelation.source.name}/1/${manyRelation.association.options.name.singular}/1/`)
                .send({name: 'changed1'})
                .expect(204)
                .then(response => {
                  return manyRelation.source.findByPk(1).then(sourceInstance => {
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
            it(`should update individual attributes of a ${manyRelation.association.associationType} relation of the resource`, async () => {
              return request(app)
                .patch(`/${manyRelation.source.name}/1/${manyRelation.association.options.name.singular}/1/`)
                .send({name: 'changed'})
                .expect(204)
                .then(response => {
                  return manyRelation.source.findByPk(1).then(sourceInstance => {
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
            it(`should delete all ${manyRelation.association.associationType} relations of the resource`, async () => {
              return request(app)
                .delete(`/${manyRelation.source.name}/1/${manyRelation.association.options.name.singular}`)
                .expect(204)
                .then(response => {
                  return manyRelation.source.findByPk(1).then(sourceInstance => {
                    return sourceInstance[manyRelation.association.accessors.get]().then(targetInstances => {
                      expect(targetInstances).to.have.lengthOf(0);
                    });
                  });
                });
            });
            it('should return a 404 if the source that the target is attached to does not exist.', async () => {
              return request(app)
                .delete(`/${manyRelation.source.name}/1000/${manyRelation.association.options.name.singular}/1`)
                .expect(404)
                .then(response => {
                  expect(response.body.message).to.equal('source not found.');
                });
            });
          });
          it(`should delete a specific ${manyRelation.association.associationType} relation of the resource`, async () => {
            return request(app)
              .delete(`/${manyRelation.source.name}/1/${manyRelation.association.options.name.singular}/1`)
              .expect(204)
              .then(response => {
                return manyRelation.source.findByPk(1).then(sourceInstance => {
                  return sourceInstance[manyRelation.association.accessors.get]().then(targetInstances => {
                    expect(targetInstances).to.have.lengthOf(2);
                  });
                });
              });
          });
          it(`should return 404 if the ${manyRelation.association.associationType} relation does not exist for the resource`, async () => {
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
            if (manyRelation.target !== AliasChild) {
              it('should handle pagination correctly for child models', async () => {
                return request(app).post(`/${manyRelation.source.name}/1/${manyRelation.association.options.name.singular}/search/`)
                  .send({i: 1, p: 0, s: {name: {like: '%%'}}})
                  .expect(200)
                  .then(response => {
                    expect(response.body.result).to.have.lengthOf(1);
                  });
              });
              it('should handle pagination correctly for child models using includes', async () => {
                return request(app).post(`/${manyRelation.source.name}/1/${manyRelation.association.options.name.singular}/search/`)
                  .send({
                    p: 0,
                    i: 2,
                    s: {
                      include: [{
                        model: 'AliasChildBelongsToManyIncludeTest'
                      }],
                      name: {like: '%%'}
                    }
                  })
                  .expect(200)
                  .then(response => {
                    expect(response.body.result).to.have.lengthOf(2);
                    expect(response.body.result[0].AliasChildBelongsToManyIncludeTests).to.have.lengthOf(10);
                    expect(response.body.result[1].AliasChildBelongsToManyIncludeTests).to.have.lengthOf(5);
                  });
              });
              it('should handle pagination correctly for child models using nested includes', async () => {
                return request(app).post(`/${manyRelation.source.name}/1/${manyRelation.association.options.name.singular}/search/`)
                  .send({
                    p: 0,
                    i: 1,
                    s: {
                      include: [{
                        model: 'AliasChildBelongsToManyIncludeTest',
                        include: [{
                          model: 'AliasChildBelongsToManyNestedIncludeTest'
                        }]
                      }],
                      name: {like: '%%'}
                    }
                  })
                  .expect(200)
                  .then(response => {
                    expect(response.body.result).to.have.lengthOf(1);
                    expect(response.body.result[0].AliasChildBelongsToManyIncludeTests).to.have.lengthOf(10);
                    expect(response.body.result[0].AliasChildBelongsToManyIncludeTests[0].AliasChildBelongsToManyNestedIncludeTests)
                      .to.have.lengthOf(10);
                  });
              });
              it('should handle pagination correctly for child models using nested includes and a where statement', async () => {
                return request(app).post(`/${manyRelation.source.name}/1/${manyRelation.association.options.name.singular}/search/`)
                  .send({
                    p: 0,
                    i: 2,
                    s: {
                      include: [{
                        model: 'AliasChildBelongsToManyIncludeTest',
                        where: {
                          name: 'AliasChildBelongsToManyIncludeTest-5'
                        },
                        include: [{
                          model: 'AliasChildBelongsToManyNestedIncludeTest',
                          where: {
                            name: 'AliasChildBelongsToManyNestedIncludeTest-3'
                          }
                        }]
                      }],
                      name: {like: '%%'}
                    }
                  })
                  .expect(200)
                  .then(response => {
                    expect(response.body.result).to.have.lengthOf(1);
                    expect(response.body.result[0].AliasChildBelongsToManyIncludeTests).to.have.lengthOf(1);
                    expect(response.body.result[0].AliasChildBelongsToManyIncludeTests[0].name)
                      .to.equal('AliasChildBelongsToManyIncludeTest-5');

                    expect(response.body.result[0].AliasChildBelongsToManyIncludeTests[0].AliasChildBelongsToManyNestedIncludeTests)
                      .to.have.lengthOf(1);
                    expect(response.body.result[0].AliasChildBelongsToManyIncludeTests[0]
                      .AliasChildBelongsToManyNestedIncludeTests[0].name)
                      .to.equal('AliasChildBelongsToManyNestedIncludeTest-3');
                  });
              });
            }
            it('should return the instances of the child model that match the search criteria', async () => {
              return request(app).post(`/${manyRelation.source.name}/1/${manyRelation.association.options.name.singular}/search`)
                .send({s: {name: manyRelation.searchFor}})
                .expect(200)
                .then(response => {
                  expect(response.header['x-total-count']).to.equal('1');
                  expect(response.body.result).to.have.lengthOf(1);
                  expect(response.body.result[0].name).to.equal(manyRelation.searchFor);
                });
            });
            it('should return the instances of the child model that match the search criteria 2', async () => {
              return request(app).post(`/${manyRelation.source.name}/1/${manyRelation.association.options.name.singular}/search`)
                .send({
                  s: {
                    name: {
                      'like': `%${manyRelation.association.associationType}%`
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
};
