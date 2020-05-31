/* eslint-disable no-unused-expressions */
'use strict';

const {expect} = require('chai');

const modelExtensionImport = require('../../../lib/model');
const {alwaysAllowMiddleware} = require('../../../lib/authorization/middleware');

const unauthorizedError = new Error();
unauthorizedError.status = 401;

const denyAccess = (req, res, next) => next(unauthorizedError);
const allowAccess = (req, res, next) => next();
const denyFallThrough = (req, res, next) => next(unauthorizedError);

module.exports = (Sequelize) => {
  console.log('LOADING!!');
  const database = require('../../database')(Sequelize);
  const modelExtension = modelExtensionImport(database.Sequelize);

  describe('Model Extension', () => {
    describe('removeModelExtension', () => {
      const RemoveExtensionModel =
        database.sequelize.define('RemoveExtensionModel', {});
      const modelDefinitions = [
        {model: RemoveExtensionModel, opts: {}}
      ];
      modelExtension(modelDefinitions, RemoveExtensionModel);
      it('should remove the extension', () => {
        RemoveExtensionModel.removeModelExtension();
        expect(RemoveExtensionModel.EXSEQ_MODEL_MIXIN).to.not.exist;
      });
    });
    describe('getAuthorizationMiddleWare', () => {
      const CreateAllowOtherDenyFallThroughModel =
        database.sequelize.define('CreateAllowOtherDenyFallThroughModel', {});

      const modelDefinitions = [
        {model: CreateAllowOtherDenyFallThroughModel, opts: {authorizeWith: {rules: {CREATE: allowAccess, OTHER: denyFallThrough}}}}
      ];

      [
        CreateAllowOtherDenyFallThroughModel
      ].forEach(model => modelExtension(modelDefinitions, model));

      it('should use OTHER if there is no specified behaviour for the requested type.', () => {
        expect(CreateAllowOtherDenyFallThroughModel.getAuthorizationMiddleWare(null, 'UPDATE_PARTIAL')).to.equal(denyFallThrough);
      });
      it('should not allow illegal auth types.', () => {
        expect(
          CreateAllowOtherDenyFallThroughModel.getAuthorizationMiddleWare.bind(CreateAllowOtherDenyFallThroughModel, null, 'FOO')
        ).to.throw('unknown type');
        expect(
          CreateAllowOtherDenyFallThroughModel.getAuthorizationMiddleWare.bind(CreateAllowOtherDenyFallThroughModel, null, 'BAR')
        ).to.throw('unknown type');
      });
      it('should allow legal auth types.', () => {
        expect(
          CreateAllowOtherDenyFallThroughModel.getAuthorizationMiddleWare.bind(CreateAllowOtherDenyFallThroughModel, null, 'CREATE')
        ).not.to.throw();
        expect(
          CreateAllowOtherDenyFallThroughModel.getAuthorizationMiddleWare.bind(CreateAllowOtherDenyFallThroughModel, null, 'UPDATE_PARTIAL')
        ).not.to.throw();
      });
      it('should allow access when there is no specified behaviour, but the authorizedWith.rules block is provided.', () => {
        const TestAuthorizedWithEmptyModel = database.sequelize.define('TestAuthorizedWithEmptyModel', {});
        modelExtension([{model: TestAuthorizedWithEmptyModel, opts: {authorizeWith: {rules: {}}}}], TestAuthorizedWithEmptyModel);
        expect(TestAuthorizedWithEmptyModel.getAuthorizationMiddleWare(null, 'UPDATE_PARTIAL')).to.equal(alwaysAllowMiddleware);
      });
      it('should allow access when there is no specified behaviour, but the authorizedWith block is provided.', () => {
        const TestAuthorizedWithEmptyModel = database.sequelize.define('TestAuthorizedWithEmptyModel', {});
        modelExtension([{model: TestAuthorizedWithEmptyModel, opts: {authorizeWith: {}}}], TestAuthorizedWithEmptyModel);
        expect(TestAuthorizedWithEmptyModel.getAuthorizationMiddleWare(null, 'UPDATE_PARTIAL')).to.equal(alwaysAllowMiddleware);
      });
      it('should allow access when there is no specified behaviour, and the authorizedWith block is not provided.', () => {
        const TestAuthorizedWithEmptyModel = database.sequelize.define('TestAuthorizedWithEmptyModel', {});
        modelExtension([{model: TestAuthorizedWithEmptyModel, opts: {}}], TestAuthorizedWithEmptyModel);
        expect(TestAuthorizedWithEmptyModel.getAuthorizationMiddleWare(null, 'UPDATE_PARTIAL')).to.equal(alwaysAllowMiddleware);
      });
    });
  });
};
