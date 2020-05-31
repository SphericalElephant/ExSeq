'use strict';

const {expect} = require('chai');

const modelExtensionImport = require('../../../lib/model');

const unauthorizedError = new Error();
unauthorizedError.status = 401;

const denyAccess = (req, res, next) => next(unauthorizedError);
const allowAccess = (req, res, next) => next();
const denyFallThrough = (req, res, next) => next(unauthorizedError);

module.export = (Sequelize) => {
  const database = require('../../database')(Sequelize);
  const modelExtension = modelExtensionImport(database.Sequelize);

  describe('Model Extension (4.x.x)', () => {
    describe('getAuthorizationMiddleWare', () => {
      it('should use OTHER if there is no specified behaviour for the requested type.', () => {
        const GetAuthorizationMiddlewareTestModel =
          database.sequelize.define('GetAuthorizationMiddlewareTestModel', {});
        modelExtension([{
          model: GetAuthorizationMiddlewareTestModel, opts: {authorizeWith: {rules: {CREATE: allowAccess, OTHER: denyFallThrough}}}
        }]);

        expect(GetAuthorizationMiddlewareTestModel.getAuthorizationMiddleWare(null, 'UPDATE_PARTIAL')).to.equal(denyFallThrough);
      });
    });
  });
};
