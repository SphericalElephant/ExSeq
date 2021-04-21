/* eslint-disable max-len */
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
  const database = require('../../database')(Sequelize);
  const modelExtension = modelExtensionImport(database.Sequelize);

  describe('Model Extension', () => {
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
      describe('Parent / Child Authorization', () => {
        let ParentAuthorizationModel;
        let ChildAuthorizationModel;

        beforeEach(() => {
          ParentAuthorizationModel = database.sequelize.define('ParentAuthorizationModel', {});
          ChildAuthorizationModel = database.sequelize.define('ChildAuthorizationModel', {});
        });

        it('should check that the associatedModel is not null', () => {
          modelExtension([{model: ParentAuthorizationModel, opts: {authorizeWith: {options: {useParentForAuthorization: true}}}}], ParentAuthorizationModel);
          expect(ParentAuthorizationModel.getAuthorizationMiddleWare.bind(ParentAuthorizationModel, null, 'OTHER')).to.throw('associatedModel is null');
        });
        it('should check if an association between the models exists', () => {
          const modelDefinitions = [
            {model: ParentAuthorizationModel, opts: {authorizeWith: {options: {useParentForAuthorization: true}}}},
            {model: ChildAuthorizationModel, opts: {}}
          ];

          modelExtension(modelDefinitions, ParentAuthorizationModel);
          modelExtension(modelDefinitions, ChildAuthorizationModel);

          expect(ParentAuthorizationModel.getAuthorizationMiddleWare.bind(ParentAuthorizationModel, ChildAuthorizationModel, 'OTHER'))
            .to.throw('ParentAuthorizationModel has no association to ChildAuthorizationModel!');
        });
        it('should check if the association between the models is valid', () => {
          ParentAuthorizationModel.hasMany(ChildAuthorizationModel);
          const modelDefinitions = [
            {model: ParentAuthorizationModel, opts: {authorizeWith: {options: {useParentForAuthorization: true}}}},
            {model: ChildAuthorizationModel, opts: {}}
          ];

          modelExtension(modelDefinitions, ParentAuthorizationModel);
          modelExtension(modelDefinitions, ChildAuthorizationModel);

          expect(ParentAuthorizationModel.getAuthorizationMiddleWare.bind(ParentAuthorizationModel, ChildAuthorizationModel, 'OTHER'))
            .to.throw('ParentAuthorizationModel has no BelongsTo / BelongsToMany association to ChildAuthorizationModel, useParentForAuthorization is invalid');
        });
        it('should use the parent authorization if useParentForAuthorization is "true"', () => {
          ChildAuthorizationModel.belongsTo(ParentAuthorizationModel);
          const modelDefinitions = [
            {model: ChildAuthorizationModel, opts: {authorizeWith: {options: {useParentForAuthorization: true}, rules: {CREATE: denyAccess}}}},
            {model: ParentAuthorizationModel, opts: {authorizeWith: {options: {}, rules: {CREATE: allowAccess}}}}
          ];

          modelExtension(modelDefinitions, ParentAuthorizationModel);
          modelExtension(modelDefinitions, ChildAuthorizationModel);

          expect(ChildAuthorizationModel.getAuthorizationMiddleWare(ParentAuthorizationModel, 'CREATE')).to.equal(allowAccess);
        });
        it('should not use the parent authorization if useParentForAuthorization is not set', () => {
          const modelDefinitions = [
            {model: ChildAuthorizationModel, opts: {authorizeWith: {options: {}, rules: {CREATE: denyAccess}}}},
            {model: ParentAuthorizationModel, opts: {authorizeWith: {options: {}, rules: {CREATE: allowAccess}}}}
          ];

          modelExtension(modelDefinitions, ParentAuthorizationModel);
          modelExtension(modelDefinitions, ChildAuthorizationModel);

          expect(ChildAuthorizationModel.getAuthorizationMiddleWare(ParentAuthorizationModel, 'CREATE')).to.equal(denyAccess);
        });
        it('should not use the parent authorization if useParentForAuthorization is set to false', () => {
          const modelDefinitions = [
            {model: ChildAuthorizationModel, opts: {authorizeWith: {options: {useParentForAuthorization: false}, rules: {CREATE: denyAccess}}}},
            {model: ParentAuthorizationModel, opts: {authorizeWith: {options: {}, rules: {CREATE: allowAccess}}}}
          ];

          modelExtension(modelDefinitions, ParentAuthorizationModel);
          modelExtension(modelDefinitions, ChildAuthorizationModel);

          expect(ChildAuthorizationModel.getAuthorizationMiddleWare(ParentAuthorizationModel, 'CREATE')).to.equal(denyAccess);
        });
        it('should obtain the parent\'s authorization', () => {
          const modelDefinitions = [
            {model: ChildAuthorizationModel, opts: {authorizeWith: {options: {}, rules: {CREATE: denyAccess}}}},
            {
              model: ParentAuthorizationModel, opts: {
                authorizeWith: {
                  options: {
                    authorizeForChildren: [
                      {child: ChildAuthorizationModel, authorizeForChild: true}
                    ]
                  }, rules: {CREATE: allowAccess}
                }
              }
            }
          ];

          modelExtension(modelDefinitions, ParentAuthorizationModel);
          modelExtension(modelDefinitions, ChildAuthorizationModel);

          expect(ChildAuthorizationModel.getAuthorizationMiddleWare(null, 'CREATE')).to.equal(allowAccess);
        });
        it('must not accept multiple parents demanding authorization jurisdiction', () => {
          const ParentAuthorizationModel2 = database.sequelize.define('ParentAuthorizationModel2', {});

          const modelDefinitions = [
            {model: ChildAuthorizationModel, opts: {authorizeWith: {options: {}, rules: {CREATE: denyAccess}}}},
            {
              model: ParentAuthorizationModel, opts: {
                authorizeWith: {
                  options: {
                    authorizeForChildren: [
                      {child: ChildAuthorizationModel, authorizeForChild: true}
                    ]
                  }, rules: {CREATE: allowAccess}
                }
              }
            },
            {
              model: ParentAuthorizationModel2, opts: {
                authorizeWith: {
                  options: {
                    authorizeForChildren: [
                      {child: ChildAuthorizationModel, authorizeForChild: true}
                    ]
                  }, rules: {CREATE: allowAccess}
                }
              }
            }
          ];

          modelExtension(modelDefinitions, ParentAuthorizationModel);
          modelExtension(modelDefinitions, ParentAuthorizationModel2);
          modelExtension(modelDefinitions, ChildAuthorizationModel);

          expect(ChildAuthorizationModel.getAuthorizationMiddleWare.bind(ChildAuthorizationModel, null, 'CREATE'))
            .to.throw('invalid number of middlewares expected 1, got 2!');
        });
      });
    });
  });
};
