'use strict';

const express = require('express');
const sequelize = require('sequelize');
const _ = require('lodash');
const modelExtension = require('./lib/model');
const relationShipMiddlewareFactory = require('./middleware/relationship');

require('./lib/string');

const _attachReply = (req, res, next, status, result, message) => {
  res.__payload = {status, result, message};
  next();
  return Promise.resolve();
};

const _handleError = (next, err) => {
  if (err instanceof sequelize.ValidationError)
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

const _updateRelation = async (source, target, association, req, res, next, id, targetId, prepareBody) => {
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
    await update(req, res, next, targetInstance.get({plain: true}).id, prepareBody);
  } catch (err) {
    handleError(err);
  }
};

const _obtainExcludeRule = (excludeRules, method, targetName, all) => {
  return _.find(excludeRules, (r) => r.method === method && r.relation === targetName && (r.all !== false) === (all !== false));
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

  if ((!limit || !offset) && limit !== offset) {
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

const _attachSearchToQuery = async (req, source = 'query', query) => {
  const s = req[source];
  if (!s) return _createErrorPromise(500, `invalid source ${source}`);

  const where = s.s;
  let newQuery = Object.assign({}, query);
  newQuery = Object.assign(newQuery, {where});
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
  const isAllowed = ['CREATE', 'READ', 'UPDATE', 'UPDATE_PARTIAL', 'DELETE', 'SEARCH', 'OTHER']
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
      include = [{model: association.target, as: association.options.as.plural}];
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
      includeOpts.as = association.options.as.plural;
    }
    return await association.source.count({
      include: [includeOpts]
    });
  } else {
    throw new Error('Unsupported!');
  }
};

module.exports = (models, opts) => {
  const routingInformation = [];
  opts = opts || {};
  opts.middleware = opts.middleware || {};

  if (!models) throw new Error('models must be set!');
  if (!(models instanceof Array)) throw new Error('models must be an array');
  // first pass, register all models
  models.forEach(model => {
    modelExtension(model.model);
    model.opts = model.opts || {};
    if (_.find(routingInformation, (i) => {
      return (i.route || i.model.model.name) === (model.opts.route || model.model.name);
    }))
      throw new Error(`model ${model.model.name} already registered`);
    const router = express.Router();
    routingInformation.push({
      model,
      route: model.opts.route || model.model.name,
      router
    });
  });
  // second pass, create routes for models
  routingInformation.forEach(routing => {
    const router = routing.router;
    const model = routing.model.model;
    const update = _update.bind(null, model);

    const auth = _getAuthorizationMiddleWare.bind(null, models, model, null);

    if (opts.middleware.associationMiddleware) {
      const associationMiddleware = relationShipMiddlewareFactory(
        models.map(modelDefinition => modelDefinition.model), opts.middleware.associationMiddleware
      );
      router.use(associationMiddleware);
    }

    router.post('/', auth('CREATE'), (req, res, next) => {
      const attachReply = _attachReply.bind(null, req, res, next);
      const handleError = _handleError.bind(null, next);
      const input = model.removeIllegalAttributes(req.body);

      model
        .create(input)
        .then(modelInstance => {
          return attachReply(201, model.filterReferenceAttributesFromModelInstance(modelInstance.get({plain: true})));
        }).catch(err => {
          return handleError(err);
        });
    });

    router.get('/count', auth('READ'), async (req, res, next) => {
      const attachReply = _attachReply.bind(null, req, res, next);
      const handleError = _handleError.bind(null, next);
      try {
        return attachReply(200, await model.count(), `Count for ${model.name} obtained!`);
      } catch (err) {
        return handleError(err);
      }
    });

    router.get('/', auth('READ'), async (req, res, next) => {
      const attachReply = _attachReply.bind(null, req, res, next);
      const handleError = _handleError.bind(null, next);
      try {
        const query = await _createQuery(req, 'query');
        const results = await model.findAll(query);
        return attachReply(200, results.map(instance => instance.get({plain: true})));
      } catch (err) {
        return handleError(err);
      }
    });

    router.post('/search', auth('SEARCH'), async (req, res, next) => {
      const attachReply = _attachReply.bind(null, req, res, next);
      const handleError = _handleError.bind(null, next);
      try {
        const query = await _createQuery(req, 'body');
        const searchQuery = await _attachSearchToQuery(req, 'body', query);
        const results = await model.findAll(searchQuery);

        res.set('X-Total-Count', await model.count(await _attachSearchToQuery(req, 'body', {})));
        if (results.length === 0) {
          return attachReply(204);
        } else {
          return attachReply(200, results.map(instance => instance.get({plain: true})));
        }
      } catch (err) {
        return handleError(err);
      }
    });

    router.get('/:id', auth('READ'), (req, res, next) => {
      const id = req.params.id;
      if (id === 'count') {
        return next();
      }
      const attachReply = _attachReply.bind(null, req, res, next);
      const handleError = _handleError.bind(null, next);

      const attributes = req.query.a ? req.query.a.split('|') : undefined;
      model.findOne({where: {id}, attributes}).then(modelInstance => {
        if (!modelInstance) return _createErrorPromise(404, 'entity not found.');
        return attachReply(200, modelInstance);
      }).catch(err => {
        return handleError(err);
      });
    });

    router.put('/:id', auth('UPDATE'), async (req, res, next) => {
      await update(req, res, next, req.params.id, (body) => {
        return model.fillMissingUpdateableAttributes(null, null, model.removeIllegalAttributes(body));
      });
    });

    router.patch('/:id', auth('UPDATE_PARTIAL'), async (req, res, next) => {
      await update(req, res, next, req.params.id, (body) => {
        return model.removeIllegalAttributes(body);
      });
    });

    router.delete('/:id', auth('DELETE'), async (req, res, next) => {
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

    model.getAssociatedModelNames().forEach(associationName => {
      const association = model.getAssociationByName(associationName);
      const target = association.target;
      const source = association.source;
      const targetRoute = association.options.name.singular;
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
      switch (association.associationType) {
        case 'HasOne':
        case 'BelongsTo':
          router.get(`/:id/${targetRoute}`, auth('READ'),
            relationshipGet((req, result) => _filterAttributes(req.query.a, result.get({plain: true}))));
          router.post(`/:id/${targetRoute}`, auth('CREATE'), (req, res, next) => {
            const attachReply = _attachReply.bind(null, req, res, next);
            const handleError = _handleError.bind(null, next);
            source.findByPk(req.params.id).then(sourceInstance => {
              if (!sourceInstance) return _createErrorPromise(404, 'source not found.');
              return sourceInstance[association.accessors.create](target.removeIllegalAttributes(req.body));
            }).then(instance => {
              if (association.associationType === 'BelongsTo') {
                return instance[association.accessors.get]().then(createdTargetInstance => {
                  return attachReply(201, createdTargetInstance.get({plain: true}));
                });
              } else {
                return attachReply(201, instance.get({plain: true}));
              }
            }).catch(err => {
              return handleError(err);
            });
          });
          router.put(`/:id/${targetRoute}`, auth('UPDATE'), async (req, res, next) => {
            await _updateRelation(source, target, association, req, res, next, req.params.id, null, (body) => {
              return target.fillMissingUpdateableAttributes(association, source, target.removeIllegalAttributes(body));
            });
          });
          router.patch(`/:id/${targetRoute}`, auth('UPDATE_PARTIAL'), async (req, res, next) => {
            await _updateRelation(source, target, association, req, res, next, req.params.id, null, (body) => {
              return target.removeIllegalAttributes(body);
            });
          });
          router.delete(`/:id/${targetRoute}`, auth('DELETE'), (req, res, next) => {
            unlinkRelations(req, res, next, association.accessors.set);
          });
          break;
        case 'HasMany':
        case 'BelongsToMany':
          router.get(`/:id/${targetRoute}`, auth('READ'), relationshipGet((req, result) => {
            return result.map(targetInstance => _filterAttributes(req.query.a, targetInstance.get({plain: true})));
          }));
          router.get(`/:id/${targetRoute}/count`, auth('READ'), async (req, res, next) => {
            const attachReply = _attachReply.bind(null, req, res, next);
            const handleError = _handleError.bind(null, next);
            try {
              return attachReply(200, await _countAssociations(association), `Count for ${model.name} obtained!`);
            } catch (err) {
              return handleError(err);
            }
          });
          router.post(`/:id/${targetRoute}/search`, auth('SEARCH'), async (req, res, next) => {
            const attachReply = _attachReply.bind(null, req, res, next);
            const handleError = _handleError.bind(null, next);
            try {
              const query = await _createQuery(req, 'body');
              const searchQuery = await _attachSearchToQuery(req, 'body', query);
              const [searchOptions, results] = await _searchBySourceIdAndTargetQuery(association, req.params.id, searchQuery);
              res.set('X-Total-Count', await _countAssociations(association, searchOptions));
              if (results.length === 0) {
                return attachReply(204);
              } else {
                return attachReply(200, results);
              }
            } catch (err) {
              return handleError(err);
            }
          });
          router.get(`/:id/${targetRoute}/:targetId`, auth('READ'), (req, res, next) => {
            if (req.params.targetId === 'count') {
              return next();
            }
            const attachReply = _attachReply.bind(null, req, res, next);
            const handleError = _handleError.bind(null, next);
            source.findByPk(req.params.id).then(sourceInstance => {
              if (!sourceInstance) return _createErrorPromise(404, 'source not found.');
              return sourceInstance[association.accessors.get]({where: {id: {$eq: req.params.targetId}}}).spread(targetInstance => {
                if (!targetInstance) return _createErrorPromise(404, 'target not found.');
                return attachReply(200, _filterAttributes(req.query.a, targetInstance.get({plain: true})));
              });
            }).catch(err => {
              return handleError(err);
            });
          });
          router.post(`/:id/${targetRoute}`, auth('CREATE'), (req, res, next) => {
            const attachReply = _attachReply.bind(null, req, res, next);
            const handleError = _handleError.bind(null, next);
            source.findByPk(req.params.id).then(sourceInstance => {
              if (!sourceInstance) return _createErrorPromise(404, 'source not found.');
              return sourceInstance[association.accessors.create](target.removeIllegalAttributes(req.body));
            }).then(instance => {
              return attachReply(201, instance.get({plain: true}));
            }).catch(err => {
              return handleError(err);
            });
          });
          router.put(`/:id/${targetRoute}/:targetId`, auth('UPDATE'), (req, res, next) => {
            _updateRelation(source, target, association, req, res, next, req.params.id, req.params.targetId,
              (body) => {
                return target.fillMissingUpdateableAttributes(association, source, target.removeIllegalAttributes(body));
              });
          });
          router.patch(`/:id/${targetRoute}/:targetId`, auth('UPDATE_PARTIAL'), (req, res, next) => {
            _updateRelation(source, target, association, req, res, next, req.params.id, req.params.targetId,
              (body) => {
                return target.removeIllegalAttributes(body);
              });
          });
          router.delete(`/:id/${targetRoute}`, auth('DELETE'), (req, res, next) => {
            unlinkRelations(req, res, next, association.accessors.set);
          });
          router.delete(`/:id/${targetRoute}/:targetId`, auth('DELETE'), (req, res, next) => {
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
          break;
      }
    });
  });
  return routingInformation.map(routing => {
    return {route: '/' + routing.route, router: routing.router};
  });
};
