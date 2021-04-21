'use strict';

const express = require('express');
const _ = require('lodash');
const {OpenApi, OpenApiDocument} = require('./lib/openapi');
const {EXSEQ_COMPONENTS} = require('./lib/openapi/openapi-exseq');
const {QueryBuilder, ERRORS} = require('./lib/data-mapper/');
const relationShipMiddlewareFactory = require('./middleware/relationship');
const {createError, createErrorPromise} = require('./lib/error');
const {RouteExposureHandler} = require('./lib/route');
const {createReply, errorHandler, replyHandler} = require('./lib/reply');

const _update = async (model, req, res, next, id, createInput) => {
  const attributes = model.getUpdateableAttributes().map(attribute => attribute.attribute);
  try {
    const instance = await model.findByPk(id);
    if (!instance) await createErrorPromise(404);
    await instance.update(createInput(req.body), {fields: attributes});
    return res.replyHandler(next, 204);
  } catch (err) {
    return res.errorHandler(next, err);
  }
};

// TODO: this method is a mess, we need to clean it up
const _updateRelation = async (createReplyObject, source, target, association, req, res, next, id, targetId, prepareBody) => {
  try {
    const sourceInstance = await source.findByPk(id);
    const update = _update.bind(null, target);
    if (!sourceInstance) return res.replyHandler(next, 404, undefined, 'source not found.');
    const query =
      association.associationType === 'HasOne' || association.associationType === 'BelongsTo' ? undefined : {where: {id: targetId}};
    let targetInstance = await sourceInstance[association.accessors.get](query);
    if (!targetInstance) await createErrorPromise(404, 'target not found.');
    if (targetInstance instanceof Array) // "many" relationship
      targetInstance = targetInstance[0];
    await update(req, res, next, createReplyObject(targetInstance).id, prepareBody);
  } catch (err) {
    res.errorHandler(next, err);
  }
};

const _filterAttributes = (attributeString, instance) => {
  if (!attributeString) return instance;
  const attributes = attributeString ? attributeString.split('|') : undefined;
  if (instance instanceof Array) {
    return instance.map(item => {
      return _.pick(item, attributes);
    });
  } else {
    return _.pick(instance, attributes);
  }
};

// TODO: move to QueryBuilder
const _searchBySourceIdAndTargetQuery = async (association, sourceId, targetQuery) => {
  const opts = targetQuery;
  let model;
  let include;
  if (association.associationType === 'BelongsToMany') {
    model = association.source;
    if (association.options.as) {
      include = [{model: association.target, as: association.options.as.plural || association.options.as}];
    } else {
      include = [association.target];
    }
  } else if (association.associationType === 'HasMany') {
    model = association.target;
    opts.where[association.foreignKeyField] = sourceId;
  }
  if (association.associationType === 'BelongsToMany') {
    const source = await model.findByPk(sourceId, {include});
    const targets = await source[association.accessors.get](opts);
    return [opts, targets.map(t => {
      const model = association.options.through.model;
      const result = t.get({plain: true});
      delete result[model.name || model];
      return result;
    })];
  } else if (association.associationType === 'HasMany') {
    return [opts, await model.findAll(opts)];
  }
};

module.exports = (models, opts) => {
  const routingInformation = [];
  opts = opts || {};
  if (!opts.dataMapper) {
    throw new Error('you must pass a data mapper using opts.dataMapper');
  }
  const modelExtension = require('./lib/model')(opts.dataMapper);
  opts.rawDataResponse = opts.rawDataResponse === false ? false : opts.rawDataResponse || true;
  const createReplyObject = createReply.bind(null, opts.rawDataResponse);
  opts.middleware = opts.middleware || {};
  opts.openapi = opts.openapi || {};
  const idRegex = opts.idRegex ? `(${opts.idRegex})` : '';
  const namingScheme = opts.naming || function (value) {
    return value;
  };
  if (!typeof namingScheme === 'function') {
    throw new Error('naming scheme must be a function');
  }
  if (!typeof namingScheme('foo') === 'string') {
    throw new Error('naming scheme must return a string');
  }

  if (!models) throw new Error('models must be set!');
  if (!(models instanceof Array)) throw new Error('models must be an array');

  const openApiDocument = opts.openapi.document && opts.openapi.document instanceof OpenApiDocument ?
    opts.openapi.document : new OpenApiDocument(opts.openapi.document);
  openApiDocument.addComponents(EXSEQ_COMPONENTS);

  // first pass, extend all models
  models.forEach(model => modelExtension(models, model.model));

  // second pass, register all models that are flagged appropriately
  models.forEach(model => {
    model.opts = model.opts || {};
    model.opts.openapi = model.opts.openapi || {};
    model.opts.createRoutes = model.opts.createRoutes !== false ? true : false;
    model.opts.filterReferenceAttributes = model.opts.filterReferenceAttributes !== false ? true : false;
    if (!model.opts.createRoutes) {
      return;
    }
    if (routingInformation.find(i => (i.route || i.model.model.name) === (model.opts.route || model.model.name)))
      throw new Error(`model ${model.model.name} already registered`);
    const router = express.Router();
    const route = model.opts.route || namingScheme(model.model.name);
    const openApiHelper = new OpenApi(
      model.model, route, {operationIdPrefix: 'exseq', tags: [], pathOpts: model.opts.openapi}
    );
    routingInformation.push({
      model,
      route,
      router,
      opts: model.opts,
      openApiHelper
    });
    if (!openApiDocument.schemaExists(model.model.name)) {
      openApiDocument.addSchemas(OpenApi.createModelSchemasRecursive(model.model, openApiDocument.components.schemas));
    }
  });

  // third pass, create routes for models
  routingInformation.forEach(routing => {
    const router = routing.router;
    const model = routing.model.model;
    const update = _update.bind(null, model);
    const exposedRoutes = routing.opts.exposed || {};
    const queryOptions = routing.opts.queryOptions || {};
    queryOptions.whitelistedOperators = queryOptions.whitelistedOperators || opts.whitelistedOperators;
    queryOptions.models = models;
    queryOptions.model = model;
    const queryBuilder = new QueryBuilder(queryOptions);
    const openApiHelper = routing.openApiHelper;
    const routeExposureHandler = new RouteExposureHandler(exposedRoutes);

    openApiHelper.existingSchemaNames = Object.keys(openApiDocument.components.schemas);

    const openApiBaseName = `/${routing.route}`;
    [{path: '/'}, {path: '/count'}, {path: '/bulk'}, {path: '/search'}, {path: '/{id}', alternative: '/:id'}].forEach(p => {
      const pathName = `${openApiBaseName}${p.path}`.replace(/\/$/, '');
      const optName = p.alternative || p.path;
      openApiDocument.setPathIfNotExists(pathName, openApiHelper.createPathItemStub(optName));
    });

    const auth = model.getAuthorizationMiddleWare.bind(model, null);

    // attaching errorHandler and replyHandler to res
    router.use((req, res, next) => {
      // (req, res, next, status, result, message)
      res.replyHandler = replyHandler.bind(null, req, res);
      // (next, err)
      res.errorHandler = errorHandler(ERRORS);

      next();
    });

    router.use((req, res, next) => {
      // resetting the state of the query builder before each request
      queryBuilder.reset();
      next();
    });

    if (opts.middleware.associationMiddleware) {
      const associationMiddleware = relationShipMiddlewareFactory(
        models.map(modelDefinition => modelDefinition.model), opts.middleware.associationMiddleware
      );
      router.use(associationMiddleware);
    }
    if (routeExposureHandler.isRouteExposed('post', '/')) {
      router.post('/', auth('CREATE'), (req, res, next) => {
        const input = model.removeIllegalAttributes(req.body);
        model
          .create(input)
          .then(modelInstance => {
            if (routing.opts.filterReferenceAttributes) {
              return res.replyHandler(next, 201, model.filterReferenceAttributesFromModelInstance(createReplyObject(modelInstance)));
            } else {
              return res.replyHandler(next, 201, createReplyObject(modelInstance));
            }
          }).catch(err => {
            return res.errorHandler(next, err);
          });
      });
      openApiDocument.addOperationAndComponents(openApiBaseName, 'post', openApiHelper.createModelPathSpecification('post'));
    }

    if (routeExposureHandler.isRouteExposed('post', '/bulk')) {
      router.post('/bulk', auth('CREATE'), async (req, res, next) => {
        const transaction = await model.transaction();

        try {
          if (!Array.isArray(req.body)) throw createError(400, 'input must be query');
          const input = req.body.map(item => model.removeIllegalAttributes(item));

          const instances = await Promise.all(input.map(async item => {
            return model.create(item, {transaction});
          }));
          await transaction.commit();
          if (routing.opts.filterReferenceAttributes) {
            return res.replyHandler(next, 201,
              createReplyObject(instances).map(instance => model.filterReferenceAttributesFromModelInstance(instance)));
          } else {
            return res.replyHandler(next, 201, createReplyObject(instances));
          }
        } catch (err) {
          await transaction.rollback();
          return res.errorHandler(next, err);
        }
      });
      openApiDocument.addOperationAndComponents(`${openApiBaseName}/bulk`, 'post', openApiHelper.createBulkModelPathSpecification());
    }

    if (routeExposureHandler.isRouteExposed('get', '/count')) {
      router.get('/count', auth('READ'), async (req, res, next) => {
        try {
          return res.replyHandler(next, 200, await model.count(), `Count for ${model.name} obtained!`);
        } catch (err) {
          return res.errorHandler(next, err);
        }
      });
      openApiDocument.addOperationAndComponents(`${openApiBaseName}/count`, 'get', openApiHelper.createCountModelPathSpecification());
    }

    if (routeExposureHandler.isRouteExposed('get', '/')) {
      router.get('/', auth('READ'), async (req, res, next) => {
        try {
          const results = await model.findAll(
            queryBuilder
              .create(req.query)
              .prepare()
              .query
          );
          return res.replyHandler(next, 200, createReplyObject(results));
        } catch (err) {
          return res.errorHandler(next, err);
        }
      });
      openApiDocument.addOperationAndComponents(openApiBaseName, 'get', openApiHelper.createModelPathSpecification('get'));
    }

    if (routeExposureHandler.isRouteExposed('get', '/search') || routeExposureHandler.isRouteExposed('post', '/search')) {
      router.post('/search', auth('SEARCH'), async (req, res, next) => {
        try {
          const results = await model.findAll(
            queryBuilder
              .create(req.body)
              .attachSearch(req.body)
              .prepare()
              .query
          );

          res.set('X-Total-Count', await model.count(
            queryBuilder
              .reset()
              .create({})
              .attachSearch(req.body)
              .prepare()
              .query
          ));
          if (results.length === 0) {
            return res.replyHandler(next, 204);
          } else {
            return res.replyHandler(next, 200, createReplyObject(results));
          }
        } catch (err) {
          return res.errorHandler(next, err);
        }
      });
      openApiDocument.addOperationAndComponents(`${openApiBaseName}/search`, 'post', openApiHelper.createSearchModelPathSpecification());
    }

    if (routeExposureHandler.isRouteExposed('get', '/:id')) {
      router.get(`/:id${idRegex}`, auth('READ'), (req, res, next) => {
        const id = req.params.id;
        const attributes = req.query.a ? req.query.a.split('|') : undefined;
        model.findOne({where: {id}, attributes}).then(modelInstance => {
          if (!modelInstance) return createErrorPromise(404, 'entity not found.');
          return res.replyHandler(next, 200, createReplyObject(modelInstance));
        }).catch(err => {
          return res.errorHandler(next, err);
        });
      });
      openApiDocument.addOperationAndComponents(`${openApiBaseName}/{id}`, 'get', openApiHelper.createInstancePathSpecification('get'));
    }

    if (routeExposureHandler.isRouteExposed('put', '/:id')) {
      router.put(`/:id${idRegex}`, auth('UPDATE'), async (req, res, next) => {
        await update(req, res, next, req.params.id, (body) => {
          return model.fillMissingUpdateableAttributes(null, null, model.removeIllegalAttributes(body));
        });
      });
      openApiDocument.addOperationAndComponents(`${openApiBaseName}/{id}`, 'put', openApiHelper.createInstancePathSpecification('put'));
    }

    if (routeExposureHandler.isRouteExposed('patch', '/:id')) {
      router.patch(`/:id${idRegex}`, auth('UPDATE_PARTIAL'), async (req, res, next) => {
        await update(req, res, next, req.params.id, (body) => {
          return model.removeIllegalAttributes(body);
        });
      });
      openApiDocument.addOperationAndComponents(`${openApiBaseName}/{id}`, 'patch', openApiHelper.createInstancePathSpecification('patch'));
    }

    if (routeExposureHandler.isRouteExposed('delete', '/:id')) {
      router.delete(`/:id${idRegex}`, auth('DELETE'), async (req, res, next) => {
        try {
          const instance = await model.findByPk(req.params.id);
          if (!instance) await createErrorPromise(404);
          await instance.destroy();
          return res.replyHandler(next, 204);
        } catch (err) {
          return res.errorHandler(next, err);
        }
      });
      openApiDocument.addOperationAndComponents(
        `${openApiBaseName}/{id}`, 'delete', openApiHelper.createInstancePathSpecification('delete')
      );
    }

    model.getAssociatedModelNames().forEach(associationName => {
      const association = model.getAssociationByName(associationName);
      const target = association.target;
      const source = association.source;
      const targetRoute = namingScheme(association.options.name.singular);
      const auth = target.getAuthorizationMiddleWare.bind(target, source);
      // TODO: move into own file (maybe with update)
      const unlinkRelations = (req, res, next, setterFunctionName) => {
        source.findByPk(req.params.id).then(sourceInstance => {
          if (!sourceInstance) return createErrorPromise(404, 'source not found.');
          return sourceInstance[setterFunctionName](null).then(_ => {
            return res.replyHandler(next, 204);
          });
        }).catch(err => {
          return res.errorHandler(next, err);
        });
      };
      // TODO: move into own file (maybe with update)
      const relationshipGet = (postProcess) => {
        return async (req, res, next) => {
          try {
            const sourceInstance = await source.findByPk(req.params.id);
            if (!sourceInstance) throw createError(404, 'source not found.');
            const query = queryBuilder.create(req.query).prepare().query;
            const targetInstance = await sourceInstance[association.accessors.get](query);
            if (!targetInstance) throw createError(404, 'target not found.');
            return res.replyHandler(next, 200, postProcess(req, targetInstance));
          } catch (err) {
            return res.errorHandler(next, err);
          }
        };
      };

      const baseTargetRouteOpt = `/:id/${targetRoute}`;
      const baseTargetPath = `${openApiBaseName}/{id}/${targetRoute}`;
      [
        {path: '/'},
        {path: '/count'},
        {path: '/search'},
        {path: '/{targetId}', alternative: '/:targetId'},
        {path: '/{targetId}/link', alternative: '/:targetId/link'},
        {path: '/{targetId}/unlink', alternative: '/:targetId/unlink'}
      ].forEach(p => {
        const pathName = `${baseTargetPath}${p.path}`.replace(/\/$/, '');
        const optName = `${baseTargetRouteOpt}${p.alternative || p.path}`;
        openApiDocument.setPathIfNotExists(pathName, openApiHelper.createPathItemStub(optName));
      });

      switch (association.associationType) {
        case 'HasOne':
        case 'BelongsTo':
          if (routeExposureHandler.isRouteExposed('get', baseTargetRouteOpt)) {
            router.get(`/:id${idRegex}/${targetRoute}`, auth('READ'),
              relationshipGet((req, result) => _filterAttributes(req.query.a, createReplyObject(result))));
            openApiDocument.addOperationAndComponents(
              baseTargetPath, 'get', openApiHelper.createHasOneOrBelongsToPathSpecification('get', target, targetRoute)
            );
          }
          if (routeExposureHandler.isRouteExposed('post', baseTargetRouteOpt)) {
            router.post(`/:id${idRegex}/${targetRoute}`, auth('CREATE'), async (req, res, next) => {
              try {
                const sourceInstance = await source.findByPk(req.params.id);
                if (!sourceInstance) return await createErrorPromise(404, 'source not found.');
                const instance = await sourceInstance[association.accessors.create](target.removeIllegalAttributes(req.body));

                if (association.associationType === 'BelongsTo') {
                  if (instance instanceof source) { // 4.x.x
                    return sourceInstance[association.accessors.get]().then(createdTargetInstance => {
                      return res.replyHandler(next, 201, createReplyObject(createdTargetInstance));
                    });
                  } else if (instance instanceof target) { // 5.x.x
                    return res.replyHandler(next, 201, createReplyObject(instance));
                  } else {
                    createErrorPromise(
                      500,
                      'could not determine target instance, this is most likely a cause of the sequelize version that is currently used'
                    );
                  }
                } else {
                  return res.replyHandler(next, 201, createReplyObject(instance));
                }
              } catch (err) {
                res.errorHandler(next, err);
              }
            });
            openApiDocument.addOperationAndComponents(
              baseTargetPath, 'post', openApiHelper.createHasOneOrBelongsToPathSpecification('post', target, targetRoute)
            );
          }
          if (routeExposureHandler.isRouteExposed('put', baseTargetRouteOpt)) {
            router.put(`/:id${idRegex}/${targetRoute}`, auth('UPDATE'), async (req, res, next) => {
              await _updateRelation(createReplyObject, source, target, association, req, res, next, req.params.id, null, (body) => {
                return target.fillMissingUpdateableAttributes(association, source, target.removeIllegalAttributes(body));
              });
            });
            openApiDocument.addOperationAndComponents(
              baseTargetPath, 'put', openApiHelper.createHasOneOrBelongsToPathSpecification('put', target, targetRoute)
            );
          }
          if (routeExposureHandler.isRouteExposed('patch', baseTargetRouteOpt)) {
            router.patch(`/:id${idRegex}/${targetRoute}`, auth('UPDATE_PARTIAL'), async (req, res, next) => {
              await _updateRelation(createReplyObject, source, target, association, req, res, next, req.params.id, null, (body) => {
                return target.removeIllegalAttributes(body);
              });
            });
            openApiDocument.addOperationAndComponents(
              baseTargetPath, 'patch', openApiHelper.createHasOneOrBelongsToPathSpecification('patch', target, targetRoute)
            );
          }
          if (routeExposureHandler.isRouteExposed('delete', baseTargetRouteOpt)) {
            router.delete(`/:id${idRegex}/${targetRoute}`, auth('DELETE'), (req, res, next) => {
              unlinkRelations(req, res, next, association.accessors.set);
            });
            openApiDocument.addOperationAndComponents(
              baseTargetPath, 'delete', openApiHelper.createHasOneOrBelongsToPathSpecification('delete', target, targetRoute)
            );
          }
          break;
        case 'HasMany':
        case 'BelongsToMany':
          const instanceTargetRouteOpt = `${baseTargetRouteOpt}/:targetId`;
          const instanceTargetPath = `${baseTargetPath}/{targetId}`;
          if (routeExposureHandler.isRouteExposed('get', baseTargetRouteOpt)) {
            router.get(`/:id${idRegex}/${targetRoute}`, auth('READ'), relationshipGet((req, result) => {
              return result.map(targetInstance => _filterAttributes(req.query.a, createReplyObject(targetInstance)));
            }));
            openApiDocument.addOperationAndComponents(
              baseTargetPath, 'get', openApiHelper.createHasManyOrBelongsToManyPathSpecfication('get', target, targetRoute)
            );
          }
          if (routeExposureHandler.isRouteExposed('get', `${baseTargetRouteOpt}/count`)) {
            router.get(`/:id${idRegex}/${targetRoute}/count`, auth('READ'), async (req, res, next) => {
              try {
                return res.replyHandler(next, 200,
                  await source.getAssociationCount(association, req.params.id),
                  `Count for ${model.name} obtained!`);
              } catch (err) {
                return res.errorHandler(next, err);
              }
            });
            openApiDocument.addOperationAndComponents(
              `${baseTargetPath}/count`, 'get', openApiHelper.createCountHasManyOrBelongsToManyPathSpecfication(target, targetRoute)
            );
          }

          if (routeExposureHandler.isRouteExposed('post', `${baseTargetRouteOpt}/search`)) {
            router.post(`/:id${idRegex}/${targetRoute}/search`, auth('SEARCH'), async (req, res, next) => {
              try {
                const searchQuery = queryBuilder
                  .create(req.body)
                  .attachSearch(req.body)
                  .prepare()
                  .query;
                const [searchOptions, results] = await _searchBySourceIdAndTargetQuery(association, req.params.id, searchQuery);
                res.set('X-Total-Count', await source.getAssociationCount(association, req.params.id, searchOptions));
                if (results.length === 0) {
                  return res.replyHandler(next, 204);
                } else {
                  return res.replyHandler(next, 200, createReplyObject(results));
                }
              } catch (err) {
                return res.errorHandler(next, err);
              }
            });
            openApiDocument.addOperationAndComponents(
              `${baseTargetPath}/search`, 'post', openApiHelper.createSearchHasManyOrBelongsToManyPathSpecfication(target, targetRoute)
            );
          }

          if (routeExposureHandler.isRouteExposed('get', instanceTargetRouteOpt)) {
            router.get(`/:id${idRegex}/${targetRoute}/:targetId${idRegex}`, auth('READ'), (req, res, next) => {
              source.findByPk(req.params.id).then(async sourceInstance => {
                if (!sourceInstance) return createErrorPromise(404, 'source not found.');

                const instances = await sourceInstance[association.accessors.get]({where: {id: req.params.targetId}});
                if (instances.length === 0) return createErrorPromise(404, 'target not found.');

                if (instances[0] instanceof source) { // 4.x.x
                  return sourceInstance[association.accessors.get]({where: {id: {$eq: req.params.targetId}}}).spread(targetInstance => {
                    if (!targetInstance) return createErrorPromise(404, 'target not found.');
                    return res.replyHandler(next, 200, _filterAttributes(req.query.a, createReplyObject(targetInstance)));
                  });
                } else if (instances[0] instanceof target) { // 5.x.x
                  return res.replyHandler(next, 200, _filterAttributes(req.query.a, createReplyObject(instances[0])));
                } else {
                  return createErrorPromise(
                    500,
                    'could not determine target instance, this is most likely a cause of the sequelize version that is currently used'
                  );
                }
              }).catch(err => {
                return res.errorHandler(next, err);
              });
            });
            openApiDocument.addOperationAndComponents(
              instanceTargetPath, 'get', openApiHelper.createHasManyOrBelongsToManyInstancePathSpecfication('get', target, targetRoute)
            );
          }

          if (routeExposureHandler.isRouteExposed('post', baseTargetRouteOpt)) {
            router.post(`/:id${idRegex}/${targetRoute}`, auth('CREATE'), (req, res, next) => {
              source.findByPk(req.params.id).then(sourceInstance => {
                if (!sourceInstance) return createErrorPromise(404, 'source not found.');
                return sourceInstance[association.accessors.create](target.removeIllegalAttributes(req.body));
              }).then(instance => {
                return res.replyHandler(next, 201, createReplyObject(instance));
              }).catch(err => {
                return res.errorHandler(next, err);
              });
            });
            openApiDocument.addOperationAndComponents(
              baseTargetPath, 'post', openApiHelper.createHasManyOrBelongsToManyPathSpecfication('post', target, targetRoute)
            );
          }
          if (association.associationType === 'BelongsToMany') {
            if (routeExposureHandler.isRouteExposed('post', `${instanceTargetRouteOpt}/link`)) {
              router.post(`/:id${idRegex}/${targetRoute}/:targetId${idRegex}/link`, auth('ASSOCIATE'), async (req, res, next) => {
                try {
                  const sourceInstance = await source.findByPk(req.params.id);
                  if (!sourceInstance) return createErrorPromise(404, 'source not found.');
                  const targetInstance = await target.findByPk(req.params.targetId);
                  if (!targetInstance) return createErrorPromise(404, 'target not found.');

                  await sourceInstance[association.accessors.add](targetInstance);

                  return res.replyHandler(next, 204);
                } catch (err) {
                  return res.errorHandler(next, err);
                }
              });
              openApiDocument.addOperationAndComponents(
                `${instanceTargetPath}/link`, 'post', openApiHelper.createLinkBelongsToManyPathSpecification(target, targetRoute)
              );
            }

            if (routeExposureHandler.isRouteExposed('delete', `${instanceTargetRouteOpt}/unlink`)) {
              router.delete(`/:id${idRegex}/${targetRoute}/:targetId${idRegex}/unlink`, auth('ASSOCIATE'), async (req, res, next) => {
                try {
                  const sourceInstance = await source.findByPk(req.params.id);
                  if (!sourceInstance) return createErrorPromise(404, 'source not found.');

                  const targetInstance = await target.findByPk(req.params.targetId);
                  if (!targetInstance) return createErrorPromise(404, 'target not found.');

                  await sourceInstance[association.accessors.remove](targetInstance);

                  return res.replyHandler(next, 204);
                } catch (err) {
                  return res.errorHandler(next, err);
                }
              });
              openApiDocument.addOperationAndComponents(
                `${instanceTargetPath}/unlink`, 'delete', openApiHelper.createUnlinkBelongsToManyPathSpecification(target, targetRoute)
              );
            }
          }
          if (routeExposureHandler.isRouteExposed('put', instanceTargetRouteOpt)) {
            router.put(`/:id${idRegex}/${targetRoute}/:targetId${idRegex}`, auth('UPDATE'), (req, res, next) => {
              _updateRelation(createReplyObject, source, target, association, req, res, next, req.params.id, req.params.targetId,
                (body) => {
                  return target.fillMissingUpdateableAttributes(association, source, target.removeIllegalAttributes(body));
                });
            });
            openApiDocument.addOperationAndComponents(
              instanceTargetPath, 'put', openApiHelper.createHasManyOrBelongsToManyInstancePathSpecfication('put', target, targetRoute)
            );
          }

          if (routeExposureHandler.isRouteExposed('patch', instanceTargetRouteOpt)) {
            router.patch(`/:id${idRegex}/${targetRoute}/:targetId${idRegex}`, auth('UPDATE_PARTIAL'), (req, res, next) => {
              _updateRelation(createReplyObject, source, target, association, req, res, next, req.params.id, req.params.targetId,
                (body) => {
                  return target.removeIllegalAttributes(body);
                });
            });
            openApiDocument.addOperationAndComponents(
              instanceTargetPath, 'patch', openApiHelper.createHasManyOrBelongsToManyInstancePathSpecfication('patch', target, targetRoute)
            );
          }

          if (routeExposureHandler.isRouteExposed('delete', baseTargetRouteOpt)) {
            router.delete(`/:id${idRegex}/${targetRoute}`, auth('DELETE'), (req, res, next) => {
              unlinkRelations(req, res, next, association.accessors.set);
            });
            openApiDocument.addOperationAndComponents(
              baseTargetPath, 'delete', openApiHelper.createHasManyOrBelongsToManyPathSpecfication('delete', target, targetRoute)
            );
          }
          if (routeExposureHandler.isRouteExposed('delete', instanceTargetRouteOpt)) {
            router.delete(`/:id${idRegex}/${targetRoute}/:targetId${idRegex}`, auth('DELETE'), (req, res, next) => {
              source.findByPk(req.params.id).then(sourceInstance => {
                if (!sourceInstance) return createErrorPromise(404, 'source not found.');
                return sourceInstance[association.accessors.get]({where: {id: req.params.targetId}}).then(targetInstances => {
                  const targetInstance = targetInstances[0];
                  if (!targetInstance) return createErrorPromise(404, 'target not found.');
                  return sourceInstance[association.accessors.remove](targetInstance);
                }).then(() => {
                  return res.replyHandler(next, 204);
                });
              }).catch(err => {
                return res.errorHandler(next, err);
              });
            });
            openApiDocument.addOperationAndComponents(
              instanceTargetPath, 'delete',
              openApiHelper.createHasManyOrBelongsToManyInstancePathSpecfication('delete', target, targetRoute)
            );
          }
          break;
      }
    });
  });
  openApiDocument.cleanPaths();
  if (!openApiDocument.valid(opts.openapi.validationOpts || {logErrors: {level: 'error'}})) {
    throw new Error('Invalid OpenApiDocument!');
  }
  return {
    exspec: openApiDocument,
    routingInformation: routingInformation.map(routing => {
      return {route: '/' + routing.route, router: routing.router};
    })
  };
};
