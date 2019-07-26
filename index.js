'use strict';

const express = require('express');
const _ = require('lodash');
const {OpenApi, OpenApiDocument} = require('./lib/openapi');
const {EXSEQ_COMPONENTS} = require('./lib/openapi/openapi-exseq');
const {OPERATOR_TABLE, ERRORS} = require('./lib/data-mapper/');
const relationShipMiddlewareFactory = require('./middleware/relationship');

require('./lib/string');

const _attachReply = (req, res, next, status, result, message) => {
  res.__payload = {status, result, message};
  next();
  return Promise.resolve();
};

const _handleError = (next, err) => {
  if (ERRORS.ValidationError(err))
    return next(_createError(400, _formatValidationError(err)));
  else if (err.isCreatedError)
    return next(err);
  else
    return next(_createError(500, err));
};

const _createErrorPromise = (status, errInput) => {
  return Promise.reject(_createError(status, errInput));
};

const _createError = (status, errInput) => {
  const err = errInput instanceof Error ? errInput : new Error(errInput);
  err.success = false;
  err.status = status;
  err.result = !(errInput instanceof Error) ? errInput : null;
  err.isCreatedError = true;
  return err;
};

const _formatValidationError = (err) => {
  return err.errors.map(error => {
    return _.pick(error, ['type', 'path', 'value']);
  });
};

const _update = async (model, req, res, next, id, createInput) => {
  const attachReply = _attachReply.bind(null, req, res, next);
  const handleError = _handleError.bind(null, next);

  const attributes = model.getUpdateableAttributes().map(attribute => attribute.attribute);
  try {
    const instance = await model.findByPk(id);
    if (!instance) await _createErrorPromise(404);
    await instance.update(createInput(req.body), {fields: attributes});
    return attachReply(204);
  } catch (err) {
    return handleError(err);
  }
};

// TODO: this method is a mess, we need to clean it up
const _updateRelation = async (createReplyObject, source, target, association, req, res, next, id, targetId, prepareBody) => {
  const attachReply = _attachReply.bind(null, req, res, next);
  const handleError = _handleError.bind(null, next);
  try {
    const sourceInstance = await source.findByPk(id);
    const update = _update.bind(null, target);
    if (!sourceInstance) return attachReply(404, undefined, 'source not found.');
    const query =
      association.associationType === 'HasOne' || association.associationType === 'BelongsTo' ? undefined : {where: {id: targetId}};
    let targetInstance = await sourceInstance[association.accessors.get](query);
    if (!targetInstance) await _createErrorPromise(404, 'target not found.');
    if (targetInstance instanceof Array) // "many" relationsship
      targetInstance = targetInstance[0];
    await update(req, res, next, createReplyObject(targetInstance).id, prepareBody);
  } catch (err) {
    handleError(err);
  }
};

const _obtainExcludeRule = (excludeRules, method, targetName, all) => {
  return excludeRules.find((r) => r.method === method && r.relation === targetName && (r.all !== false) === (all !== false));
};

const _shouldRouteBeExposed = (excludeRules, method, targetName, all = true) => {
  return _obtainExcludeRule(excludeRules, method, targetName, all) !== undefined;
};

const _createQuery = async (req, source = 'query') => {
  const s = req[source];
  if (!s) return _createErrorPromise(500, `invalid source ${source}`);
  const limit = s.i;
  const offset = s.p;
  const attributes = s.a ? s.a.split('|') : undefined;
  const sortField = s.f;
  const sortOrder = s.o || 'DESC';

  if (sortOrder !== 'DESC' && sortOrder !== 'ASC')
    return _createErrorPromise(400, 'invalid sort order, must be DESC or ASC');

  if ((!limit || (!offset && offset !== 0)) && limit !== offset) {
    return _createErrorPromise(400, 'p or i must be both undefined or both defined.');
  }

  const limitInt = parseInt(limit || 10);
  const offsetInt = parseInt(offset || 0);

  if (((limit && (isNaN(limitInt))) || limitInt < 0) ||
    ((offset && (isNaN(offsetInt))) || offsetInt < 0)) {
    return _createErrorPromise(400, 'p or i must be integers larger than 0!');
  }

  const order = sortField ? [[sortField, sortOrder]] : undefined;
  return Promise.resolve({limit: limitInt, offset: limitInt * offsetInt, attributes, order});
};

const _attachSearchToQuery = async (req, source = 'query', query, models = []) => {
  const s = req[source];
  if (!s) return _createErrorPromise(500, `invalid source ${source}`);
  if (!s.s) return _createErrorPromise(400, 'no search parameter specified');
  const {include = [], ...where} = s.s;

  const parseInclude = (i) => {
    if (i.include) {
      i.include = i.include.map(parseInclude);
    }
    const modelToAttach = models.find((m) => i.model === m.model.name);
    if (modelToAttach) {
      return {
        ...i,
        model: modelToAttach.model
      };
    }
    return i;
  };

  const includeWithAttachedModel = include.map(parseInclude);

  // reject if one of the models could not be resolved
  const modelToReject = includeWithAttachedModel.find((i) => typeof i.model === 'string');
  if (modelToReject) {
    return _createErrorPromise(404, `unable to resolve model ${modelToReject.model}`);
  }

  let newQuery = Object.assign({}, query);
  newQuery = Object.assign(newQuery, {where, include: includeWithAttachedModel});
  return Promise.resolve(newQuery);
};

const alwaysAllowMiddleware = async (req, res, next) => next();

const _getModelOpts = (models, model) => {
  for (const modelDefinition of models) {
    if (modelDefinition.model === model) {
      return modelDefinition.opts;
    }
  }
  return {};
};

const _getParentAuthorizationForModel = (modelDefinitions, model) => {
  const authorizationMiddlewaresFound = [];
  for (const modelDefinition of modelDefinitions) {
    const authorizeForChildren = _.get(modelDefinition, 'opts.authorizeWith.options.authorizeForChildren', undefined);
    if (authorizeForChildren) {
      for (const childModelAuthDefinition of authorizeForChildren) {
        if (childModelAuthDefinition.child === model && childModelAuthDefinition.authorizeForChild) {
          authorizationMiddlewaresFound.push(_.get(modelDefinition, 'opts.authorizeWith', undefined));
        }
      }
    }
  }
  if (authorizationMiddlewaresFound.length > 1)
    throw new Error(`invalid number of middlewares expected 1, got ${authorizationMiddlewaresFound.length}!`);
  return authorizationMiddlewaresFound[0];
};

const _getAuthorizationMiddleWare = function (modelDefinitions, model, associatedModel, type) {
  const isAllowed = ['CREATE', 'READ', 'UPDATE', 'UPDATE_PARTIAL', 'DELETE', 'SEARCH', 'ASSOCIATE', 'OTHER']
    .filter(method => method == type).length === 1;
  const opts = _getModelOpts(modelDefinitions, model);
  if (!isAllowed) {
    throw new Error(`unknown type ${type}`);
  }
  let authorizeWith = opts.authorizeWith;
  if (_.get(opts, 'authorizeWith.options.useParentForAuthorization', undefined)) {
    if (!associatedModel) throw new Error(`${model.name} specified to useParentForAuthorization but the associatedModel is null!`);
    const association = model.getAssociationByModel(associatedModel);
    if (association.associationType !== 'BelongsTo' && association.associationType !== 'BelongsToMany')
      throw new Error(
        `${model.name} has no BelongsTo / BelongsToMany association to ${associatedModel.name}, useParentForAuthorization is invalid!`
      );
    const parentOpts = _getModelOpts(modelDefinitions, associatedModel);
    authorizeWith = parentOpts.authorizeWith;
  }
  // use parent model authorization for root routes of another model
  const authorizationFromParent = _getParentAuthorizationForModel(modelDefinitions, model);
  if (authorizationFromParent) authorizeWith = authorizationFromParent;

  return authorizeWith && authorizeWith.rules ?
    (authorizeWith.rules[type] || authorizeWith.rules['OTHER'] || alwaysAllowMiddleware) :
    alwaysAllowMiddleware;
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

const _countAssociations = async (association, query) => {
  const where = query ? query.where : null;
  if (association.associationType === 'HasMany') {
    return await association.target.count({where});
  } else if (association.associationType === 'BelongsToMany') {
    const includeOpts = {model: association.target, where};
    if (association.options.as) {
      includeOpts.as = association.options.as.plural || association.options.as;
    }
    return await association.source.count({
      include: [includeOpts]
    });
  } else {
    throw new Error('Unsupported!');
  }
};

const _createReplyObject = (raw, object) => {
  let objects;
  let inputWasArray = false;
  if (Array.isArray(object)) {
    inputWasArray = true;
    objects = object;
  } else {
    objects = [object];
  }
  const result = objects.map(o => {
    if (raw) {
      if (!o.get || !(o.get instanceof Function)) return o;
      return o.get({plain: true});
    } else {
      return o;
    }
  });
  if (!inputWasArray) return result[0];
  else return result;
};

module.exports = (models, opts) => {
  const routingInformation = [];
  opts = opts || {};
  if (!opts.dataMapper) {
    throw new Error('you must pass a data mapper using opts.dataMapper');
  }
  const modelExtension = require('./lib/model')(opts.dataMapper);
  opts.rawDataResponse = opts.rawDataResponse === false ? false : opts.rawDataResponse || true;
  const createReplyObject = _createReplyObject.bind(null, opts.rawDataResponse);
  opts.middleware = opts.middleware || {};
  opts.openapi = opts.openapi || {};
  const idRegex = opts.idRegex ? `(${opts.idRegex})` : '';
  const namingScheme = opts.naming || function (value) { return value; };
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

  const getModelOpts = _getModelOpts.bind(null, models);

  // first pass, extend all models
  models.forEach(model => modelExtension(model.model));

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
      openApiDocument.addSchemas(OpenApi.createModelSchemasRecursive(model.model, openApiDocument.components.schemas, getModelOpts));
    }
  });

  // third pass, create routes for models
  routingInformation.forEach(routing => {
    const router = routing.router;
    const model = routing.model.model;
    const update = _update.bind(null, model);
    const exposedRoutes = routing.opts.exposed || {};
    const openApiHelper = routing.openApiHelper;
    openApiHelper.existingSchemaNames = Object.keys(openApiDocument.components.schemas);

    const openApiBaseName = `/${routing.route}`;
    [{path: '/'}, {path: '/count'}, {path: '/search'}, {path: '/{id}', alternative: '/:id'}].forEach(p => {
      const pathName = `${openApiBaseName}${p.path}`.replace(/\/$/, '');
      const optName = p.alternative || p.path;
      openApiDocument.setPathIfNotExists(pathName, openApiHelper.createPathItemStub(optName));
    });

    const auth = _getAuthorizationMiddleWare.bind(null, models, model, null);

    if (opts.middleware.associationMiddleware) {
      const associationMiddleware = relationShipMiddlewareFactory(
        models.map(modelDefinition => modelDefinition.model), opts.middleware.associationMiddleware
      );
      router.use(associationMiddleware);
    }
    if (!exposedRoutes['/'] || !exposedRoutes['/'].post === false) {
      router.post('/', auth('CREATE'), (req, res, next) => {
        const attachReply = _attachReply.bind(null, req, res, next);
        const handleError = _handleError.bind(null, next);
        const input = model.removeIllegalAttributes(req.body);
        model
          .create(input)
          .then(modelInstance => {
            if (routing.opts.filterReferenceAttributes) {
              return attachReply(201, model.filterReferenceAttributesFromModelInstance(createReplyObject(modelInstance)));
            } else {
              return attachReply(201, createReplyObject(modelInstance));
            }
          }).catch(err => {
            return handleError(err);
          });
      });
      openApiDocument.addOperationAndComponents(openApiBaseName, 'post', openApiHelper.createModelPathSpecification('post'));
    }

    if (!exposedRoutes['/count'] || !exposedRoutes['/count'].get === false) {
      router.get('/count', auth('READ'), async (req, res, next) => {
        const attachReply = _attachReply.bind(null, req, res, next);
        const handleError = _handleError.bind(null, next);
        try {
          return attachReply(200, await model.count(), `Count for ${model.name} obtained!`);
        } catch (err) {
          return handleError(err);
        }
      });
      openApiDocument.addOperationAndComponents(`${openApiBaseName}/count`, 'get', openApiHelper.createCountModelPathSpecification());
    }

    if (!exposedRoutes['/'] || !exposedRoutes['/'].get === false) {
      router.get('/', auth('READ'), async (req, res, next) => {
        const attachReply = _attachReply.bind(null, req, res, next);
        const handleError = _handleError.bind(null, next);
        try {
          const query = await _createQuery(req, 'query');
          OPERATOR_TABLE.replace(query);
          const results = await model.findAll(query);
          return attachReply(200, createReplyObject(results));
        } catch (err) {
          return handleError(err);
        }
      });
      openApiDocument.addOperationAndComponents(openApiBaseName, 'get', openApiHelper.createModelPathSpecification('get'));
    }

    if (!exposedRoutes['/search'] || !exposedRoutes['/search'].get === false) {
      router.post('/search', auth('SEARCH'), async (req, res, next) => {
        const attachReply = _attachReply.bind(null, req, res, next);
        const handleError = _handleError.bind(null, next);
        try {
          const query = await _createQuery(req, 'body');
          const searchQuery = await _attachSearchToQuery(req, 'body', query, models);
          OPERATOR_TABLE.replace(searchQuery);
          const results = await model.findAll(searchQuery);

          res.set('X-Total-Count', await model.count(await _attachSearchToQuery(req, 'body', {}, models)));
          if (results.length === 0) {
            return attachReply(204);
          } else {
            return attachReply(200, createReplyObject(results));
          }
        } catch (err) {
          return handleError(err);
        }
      });
      openApiDocument.addOperationAndComponents(`${openApiBaseName}/search`, 'post', openApiHelper.createSearchModelPathSpecification());
    }

    if (!exposedRoutes['/:id'] || !exposedRoutes['/:id'].get === false) {
      router.get(`/:id${idRegex}`, auth('READ'), (req, res, next) => {
        const id = req.params.id;
        const attachReply = _attachReply.bind(null, req, res, next);
        const handleError = _handleError.bind(null, next);

        const attributes = req.query.a ? req.query.a.split('|') : undefined;
        model.findOne({where: {id}, attributes}).then(modelInstance => {
          if (!modelInstance) return _createErrorPromise(404, 'entity not found.');
          return attachReply(200, createReplyObject(modelInstance));
        }).catch(err => {
          return handleError(err);
        });
      });
      openApiDocument.addOperationAndComponents(`${openApiBaseName}/{id}`, 'get', openApiHelper.createInstancePathSpecification('get'));
    }

    if (!exposedRoutes['/:id'] || !exposedRoutes['/:id'].put === false) {
      router.put(`/:id${idRegex}`, auth('UPDATE'), async (req, res, next) => {
        await update(req, res, next, req.params.id, (body) => {
          return model.fillMissingUpdateableAttributes(null, null, model.removeIllegalAttributes(body));
        });
      });
      openApiDocument.addOperationAndComponents(`${openApiBaseName}/{id}`, 'put', openApiHelper.createInstancePathSpecification('put'));
    }

    if (!exposedRoutes['/:id'] || !exposedRoutes['/:id'].patch === false) {
      router.patch(`/:id${idRegex}`, auth('UPDATE_PARTIAL'), async (req, res, next) => {
        await update(req, res, next, req.params.id, (body) => {
          return model.removeIllegalAttributes(body);
        });
      });
      openApiDocument.addOperationAndComponents(`${openApiBaseName}/{id}`, 'patch', openApiHelper.createInstancePathSpecification('patch'));
    }

    if (!exposedRoutes['/:id'] || !exposedRoutes['/:id'].delete === false) {
      router.delete(`/:id${idRegex}`, auth('DELETE'), async (req, res, next) => {
        const attachReply = _attachReply.bind(null, req, res, next);
        const handleError = _handleError.bind(null, next);
        try {
          const instance = await model.findByPk(req.params.id);
          if (!instance) await _createErrorPromise(404);
          await instance.destroy();
          return attachReply(204);
        } catch (err) {
          return handleError(err);
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
      const auth = _getAuthorizationMiddleWare.bind(null, models, target, source);

      const unlinkRelations = (req, res, next, setterFunctionName) => {
        const attachReply = _attachReply.bind(null, req, res, next);
        const handleError = _handleError.bind(null, next);

        source.findByPk(req.params.id).then(sourceInstance => {
          if (!sourceInstance) return _createErrorPromise(404, 'source not found.');
          return sourceInstance[setterFunctionName](null).then(_ => {
            return attachReply(204);
          });
        }).catch(err => {
          return handleError(err);
        });
      };
      const relationshipGet = (postProcess) => {
        return (req, res, next) => {
          const attachReply = _attachReply.bind(null, req, res, next);
          const handleError = _handleError.bind(null, next);
          source.findByPk(req.params.id).then(sourceInstance => {
            if (!sourceInstance) return _createErrorPromise(404, 'source not found.');
            return sourceInstance[association.accessors.get]().then(targetInstance => {
              if (!targetInstance) return _createErrorPromise(404, 'target not found.');
              return attachReply(200, postProcess(req, targetInstance));
            });
          }).catch(err => {
            return handleError(err);
          });
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
          if (!exposedRoutes[baseTargetRouteOpt] || !exposedRoutes[baseTargetRouteOpt].get === false) {
            router.get(`/:id${idRegex}/${targetRoute}`, auth('READ'),
              relationshipGet((req, result) => _filterAttributes(req.query.a, createReplyObject(result))));
            openApiDocument.addOperationAndComponents(
              baseTargetPath, 'get', openApiHelper.createHasOneOrBelongsToPathSpecification('get', target, targetRoute)
            );
          }
          if (!exposedRoutes[baseTargetRouteOpt] || !exposedRoutes[baseTargetRouteOpt].post === false) {
            router.post(`/:id${idRegex}/${targetRoute}`, auth('CREATE'), async (req, res, next) => {
              const attachReply = _attachReply.bind(null, req, res, next);
              const handleError = _handleError.bind(null, next);
              try {
                const sourceInstance = await source.findByPk(req.params.id);
                if (!sourceInstance) return await _createErrorPromise(404, 'source not found.');
                const instance = await sourceInstance[association.accessors.create](target.removeIllegalAttributes(req.body));

                if (association.associationType === 'BelongsTo') {
                  if (instance instanceof source) { // 4.x.x
                    return sourceInstance[association.accessors.get]().then(createdTargetInstance => {
                      return attachReply(201, createReplyObject(createdTargetInstance));
                    });
                  } else if (instance instanceof target) { // 5.x.x
                    return attachReply(201, createReplyObject(instance));
                  } else {
                    _createErrorPromise(
                      500,
                      'could not determine target instance, this is most likley a cause of the sequelize version that is currently used'
                    );
                  }
                } else {
                  return attachReply(201, createReplyObject(instance));
                }
              } catch (err) {
                handleError(err);
              }
            });
            openApiDocument.addOperationAndComponents(
              baseTargetPath, 'post', openApiHelper.createHasOneOrBelongsToPathSpecification('post', target, targetRoute)
            );
          }
          if (!exposedRoutes[baseTargetRouteOpt] || !exposedRoutes[baseTargetRouteOpt].put === false) {
            router.put(`/:id${idRegex}/${targetRoute}`, auth('UPDATE'), async (req, res, next) => {
              await _updateRelation(createReplyObject, source, target, association, req, res, next, req.params.id, null, (body) => {
                return target.fillMissingUpdateableAttributes(association, source, target.removeIllegalAttributes(body));
              });
            });
            openApiDocument.addOperationAndComponents(
              baseTargetPath, 'put', openApiHelper.createHasOneOrBelongsToPathSpecification('put', target, targetRoute)
            );
          }
          if (!exposedRoutes[baseTargetRouteOpt] || !exposedRoutes[baseTargetRouteOpt].patch === false) {
            router.patch(`/:id${idRegex}/${targetRoute}`, auth('UPDATE_PARTIAL'), async (req, res, next) => {
              await _updateRelation(createReplyObject, source, target, association, req, res, next, req.params.id, null, (body) => {
                return target.removeIllegalAttributes(body);
              });
            });
            openApiDocument.addOperationAndComponents(
              baseTargetPath, 'patch', openApiHelper.createHasOneOrBelongsToPathSpecification('patch', target, targetRoute)
            );
          }
          if (!exposedRoutes[baseTargetRouteOpt] || !exposedRoutes[baseTargetRouteOpt].delete === false) {
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
          if (!exposedRoutes[baseTargetRouteOpt] || !exposedRoutes[baseTargetRouteOpt].get === false) {
            router.get(`/:id${idRegex}/${targetRoute}`, auth('READ'), relationshipGet((req, result) => {
              return result.map(targetInstance => _filterAttributes(req.query.a, createReplyObject(targetInstance)));
            }));
            openApiDocument.addOperationAndComponents(
              baseTargetPath, 'get', openApiHelper.createHasManyOrBelongsToManyPathSpecfication('get', target, targetRoute)
            );
          }
          if (!exposedRoutes[`${baseTargetRouteOpt}/count`] || !exposedRoutes[`${baseTargetRouteOpt}/count`].get === false) {
            router.get(`/:id${idRegex}/${targetRoute}/count`, auth('READ'), async (req, res, next) => {
              const attachReply = _attachReply.bind(null, req, res, next);
              const handleError = _handleError.bind(null, next);
              try {
                return attachReply(200, await _countAssociations(association), `Count for ${model.name} obtained!`);
              } catch (err) {
                return handleError(err);
              }
            });
            openApiDocument.addOperationAndComponents(
              `${baseTargetPath}/count`, 'get', openApiHelper.createCountHasManyOrBelongsToManyPathSpecfication(target, targetRoute)
            );
          }

          if (!exposedRoutes[`${baseTargetRouteOpt}/search`] || !exposedRoutes[`${baseTargetRouteOpt}/search`].post === false) {
            router.post(`/:id${idRegex}/${targetRoute}/search`, auth('SEARCH'), async (req, res, next) => {
              const attachReply = _attachReply.bind(null, req, res, next);
              const handleError = _handleError.bind(null, next);
              try {
                const query = await _createQuery(req, 'body');
                const searchQuery = await _attachSearchToQuery(req, 'body', query, models);
                OPERATOR_TABLE.replace(searchQuery);
                const [searchOptions, results] = await _searchBySourceIdAndTargetQuery(association, req.params.id, searchQuery);
                res.set('X-Total-Count', await _countAssociations(association, searchOptions));
                if (results.length === 0) {
                  return attachReply(204);
                } else {
                  return attachReply(200, createReplyObject(results));
                }
              } catch (err) {
                return handleError(err);
              }
            });
            openApiDocument.addOperationAndComponents(
              `${baseTargetPath}/search`, 'post', openApiHelper.createSearchHasManyOrBelongsToManyPathSpecfication(target, targetRoute)
            );
          }

          if (!exposedRoutes[instanceTargetRouteOpt] || !exposedRoutes[instanceTargetRouteOpt].get === false) {
            router.get(`/:id${idRegex}/${targetRoute}/:targetId${idRegex}`, auth('READ'), (req, res, next) => {
              const attachReply = _attachReply.bind(null, req, res, next);
              const handleError = _handleError.bind(null, next);
              source.findByPk(req.params.id).then(async sourceInstance => {
                if (!sourceInstance) return _createErrorPromise(404, 'source not found.');

                const instances = await sourceInstance[association.accessors.get]({where: {id: req.params.targetId}});
                if (instances.length === 0) return _createErrorPromise(404, 'target not found.');

                if (instances[0] instanceof source) { // 4.x.x
                  return sourceInstance[association.accessors.get]({where: {id: {$eq: req.params.targetId}}}).spread(targetInstance => {
                    if (!targetInstance) return _createErrorPromise(404, 'target not found.');
                    return attachReply(200, _filterAttributes(req.query.a, createReplyObject(targetInstance)));
                  });
                } else if (instances[0] instanceof target) { // 5.x.x
                  return attachReply(200, _filterAttributes(req.query.a, createReplyObject(instances[0])));
                } else {
                  return _createErrorPromise(
                    500,
                    'could not determine target instance, this is most likley a cause of the sequelize version that is currently used'
                  );
                }
              }).catch(err => {
                return handleError(err);
              });
            });
            openApiDocument.addOperationAndComponents(
              instanceTargetPath, 'get', openApiHelper.createHasManyOrBelongsToManyInstancePathSpecfication('get', target, targetRoute)
            );
          }

          if (!exposedRoutes[baseTargetRouteOpt] || !exposedRoutes[baseTargetRouteOpt].post === false) {
            router.post(`/:id${idRegex}/${targetRoute}`, auth('CREATE'), (req, res, next) => {
              const attachReply = _attachReply.bind(null, req, res, next);
              const handleError = _handleError.bind(null, next);
              source.findByPk(req.params.id).then(sourceInstance => {
                if (!sourceInstance) return _createErrorPromise(404, 'source not found.');
                return sourceInstance[association.accessors.create](target.removeIllegalAttributes(req.body));
              }).then(instance => {
                return attachReply(201, createReplyObject(instance));
              }).catch(err => {
                return handleError(err);
              });
            });
            openApiDocument.addOperationAndComponents(
              baseTargetPath, 'post', openApiHelper.createHasManyOrBelongsToManyPathSpecfication('post', target, targetRoute)
            );
          }
          if (association.associationType === 'BelongsToMany') {
            if (!exposedRoutes[`${instanceTargetRouteOpt}/link`] || !exposedRoutes[`${instanceTargetRouteOpt}/link`].post === false) {
              router.post(`/:id${idRegex}/${targetRoute}/:targetId${idRegex}/link`, auth('ASSOCIATE'), async (req, res, next) => {
                const attachReply = _attachReply.bind(null, req, res, next);
                const handleError = _handleError.bind(null, next);
                try {
                  const sourceInstance = await source.findByPk(req.params.id);
                  if (!sourceInstance) return _createErrorPromise(404, 'source not found.');
                  const targetInstance = await target.findByPk(req.params.targetId);
                  if (!targetInstance) return _createErrorPromise(404, 'target not found.');

                  await sourceInstance[association.accessors.add](targetInstance);

                  return attachReply(204);
                } catch (err) {
                  return handleError(err);
                }
              });
              openApiDocument.addOperationAndComponents(
                `${instanceTargetPath}/link`, 'post', openApiHelper.createLinkBelongsToManyPathSpecification(target, targetRoute)
              );
            }

            if (!exposedRoutes[`${instanceTargetRouteOpt}/unlink`] || !exposedRoutes[`${instanceTargetRouteOpt}/unlink`].delete === false) {
              router.delete(`/:id${idRegex}/${targetRoute}/:targetId${idRegex}/unlink`, auth('ASSOCIATE'), async (req, res, next) => {
                const attachReply = _attachReply.bind(null, req, res, next);
                const handleError = _handleError.bind(null, next);
                try {
                  const sourceInstance = await source.findByPk(req.params.id);
                  if (!sourceInstance) return _createErrorPromise(404, 'source not found.');

                  const targetInstance = await target.findByPk(req.params.targetId);
                  if (!targetInstance) return _createErrorPromise(404, 'target not found.');

                  await sourceInstance[association.accessors.remove](targetInstance);

                  return attachReply(204);
                } catch (err) {
                  return handleError(err);
                }
              });
              openApiDocument.addOperationAndComponents(
                `${instanceTargetPath}/unlink`, 'delete', openApiHelper.createUnlinkBelongsToManyPathSpecification(target, targetRoute)
              );
            }
          }
          if (!exposedRoutes[instanceTargetRouteOpt] || !exposedRoutes[instanceTargetRouteOpt].put === false) {
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

          if (!exposedRoutes[instanceTargetRouteOpt] || !exposedRoutes[instanceTargetRouteOpt].patch === false) {
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

          if (!exposedRoutes[baseTargetRouteOpt] || !exposedRoutes[baseTargetRouteOpt].delete === false) {
            router.delete(`/:id${idRegex}/${targetRoute}`, auth('DELETE'), (req, res, next) => {
              unlinkRelations(req, res, next, association.accessors.set);
            });
            openApiDocument.addOperationAndComponents(
              baseTargetPath, 'delete', openApiHelper.createHasManyOrBelongsToManyPathSpecfication('delete', target, targetRoute)
            );
          }
          if (!exposedRoutes[instanceTargetRouteOpt] || !exposedRoutes[instanceTargetRouteOpt].delete === false) {
            router.delete(`/:id${idRegex}/${targetRoute}/:targetId${idRegex}`, auth('DELETE'), (req, res, next) => {
              const attachReply = _attachReply.bind(null, req, res, next);
              const handleError = _handleError.bind(null, next);

              source.findByPk(req.params.id).then(sourceInstance => {
                if (!sourceInstance) return _createErrorPromise(404, 'source not found.');
                return sourceInstance[association.accessors.get]({where: {id: req.params.targetId}}).then(targetInstances => {
                  const targetInstance = targetInstances[0];
                  if (!targetInstance) return _createErrorPromise(404, 'target not found.');
                  return sourceInstance[association.accessors.remove](targetInstance);
                }).then(() => {
                  return attachReply(204);
                });
              }).catch(err => {
                return handleError(err);
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
