'use strict';

const express = require('express');
const sequelize = require('sequelize');
const _ = require('lodash');

const _attachReply = (req, res, next, status, result, message) => {
    res.__payload = {status, result, message};
    next();
    return Promise.resolve();
}

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
}

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

const _getUpdateableAttributes = (model) => {
    return _.pull(_.keys(model.attributes), 'id', 'updatedAt', 'createdAt', 'deletedAt')
        .filter(attribute => !model.attributes[attribute].references)
        .map(attribute => {
            const allowNull = model.attributes[attribute].allowNull;
            return {attribute, allowNull: allowNull === undefined || allowNull === true}
        });
};

const _removeIllegalAttributes = (model, input) => {
    return _.pick(input, _getUpdateableAttributes(model).map(attr => attr.attribute));
};

const _fillMissingUpdateableAttributes = (model, input) => {
    const clonedInput = Object.assign({}, input);
    return _getUpdateableAttributes(model).reduce((result, current) => {
        if (input[current.attribute] !== undefined) result[current.attribute] = input[current.attribute];
        else result[current.attribute] = null;
        return result;
    }, {});
};

const _getAssociatedModelNames = model => {
    return _.keys(model.associations);
};

const _getAssociationByName = (model, name) => {
    return model.associations[name];
};

const _getRouterForModel = (routingInformation, model) => {
    return (_.find(routingInformation, (i) => i.model.model.name === model.name) || {router: null}).router;
};

const _update = (model, req, res, next, id, createInput) => {
    const attachReply = _attachReply.bind(null, req, res, next);
    const handleError = _handleError.bind(null, next);

    const attributes = _getUpdateableAttributes(model).map(attribute => attribute.attribute);
    model.update(createInput(req.body), {where: {id}, fields: attributes}).spread((affectedCount, affectedRows) => {
        if (affectedCount === 0) return _createErrorPromise(404);
        return attachReply(204);
    }).catch(err => {
        return handleError(err);
    });
};

const _updateRelation = (source, target, relationType, req, res, next, id, targetId, prepareBody) => {
    const attachReply = _attachReply.bind(null, req, res, next);
    const handleError = _handleError.bind(null, next);

    source.findById(id).then(sourceInstance => {
        const update = _update.bind(null, target);
        if (!sourceInstance) return attachReply(404, undefined, 'source not found.');
        const targetRelationFunctionGetterName = relationType === 'HasOne' || relationType === 'BelongsTo' ? `get${target.name}` : `get${target.name}s`;
        const query = relationType === 'HasOne' || relationType === 'BelongsTo' ? undefined : {where: {id: targetId}};
        return sourceInstance[targetRelationFunctionGetterName](query).then(targetInstance => {
            if (!targetInstance)
                return _createErrorPromise(404, 'target not found.');
            if (targetInstance instanceof Array) // "many" relationsship
                targetInstance = targetInstance[0]
            update(req, res, next, targetInstance.get({plain: true}).id, (body) => {
                return prepareBody(body);
            });
        });
    }).catch(err => {
        return handleError(err);
    });
};

const _obtainExcludeRule = (excludeRules, method, targetName, all) => {
    return _.find(excludeRules, (r) => r.method === method && r.relation === targetName && (r.all !== false) === (all !== false));
};

const _shouldRouteBeExposed = (excludeRules, method, targetName, all = true) => {
    return _obtainExcludeRule(excludeRules, method, targetName, all) !== undefined;
};

const _createQuery = async (req, source = 'query') => {
    let s = req[source];
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
    let s = req[source];
    if (!s) return _createErrorPromise(500, `invalid source ${source}`);

    const where = s.s;
    let newQuery = Object.assign({}, query);
    newQuery = Object.assign(newQuery, {where});
    return Promise.resolve(newQuery);
};

module.exports = (models) => {
    const routingInformation = [];

    if (!models) throw new Error('models must be set!');
    if (!(models instanceof Array)) throw new Error('models must be an array');

    // first pass, register all models
    models.forEach(model => {
        model.opts = model.opts || {};
        if (_.find(routingInformation, (i) => i.model.model.name === (model.opts.route || model.model.name)))
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

        const removeIllegalAttributes = _removeIllegalAttributes.bind(null, model);
        const fillMissingUpdateableAttributes = _fillMissingUpdateableAttributes.bind(null, model);
        const getAssociatedModelNames = _getAssociatedModelNames.bind(null, model);
        const getAssociationByName = _getAssociationByName.bind(null, model);
        const update = _update.bind(null, model);

        router.post('/', (req, res, next) => {
            const attachReply = _attachReply.bind(null, req, res, next);
            const handleError = _handleError.bind(null, next);
            const input = removeIllegalAttributes(req.body);

            model
                .create(input)
                .then(modelInstance => {
                    return attachReply(201, modelInstance.get({plain: true}));
                }).catch(err => {
                    return handleError(err);
                });
        });

        router.get('/', async (req, res, next) => {
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

        router.post('/search', async (req, res, next) => {
            const attachReply = _attachReply.bind(null, req, res, next);
            const handleError = _handleError.bind(null, next);
            try {
                const query = await _createQuery(req, 'body');
                const searchQuery = await _attachSearchToQuery(req, 'body', query);
                const results = await model.findAll(searchQuery);
                if (results.length === 0) {
                    return attachReply(204);
                } else {
                    return attachReply(200, results.map(instance => instance.get({plain: true})));
                }
            } catch (err) {
                return handleError(err);
            }
        });

        router.get('/:id', (req, res, next) => {
            const attachReply = _attachReply.bind(null, req, res, next);
            const handleError = _handleError.bind(null, next);

            const attributes = req.query.a ? req.query.a.split('|') : undefined;
            model.findOne({where: {id: req.params.id}, attributes}).then(modelInstance => {
                return attachReply(200, modelInstance);
            }).catch(err => {
                return handleError(err);
            });
        });

        router.put('/:id', (req, res, next) => {
            update(req, res, next, req.params.id, (body) => {
                return fillMissingUpdateableAttributes(removeIllegalAttributes(body));
            });
        });

        router.patch('/:id', (req, res, next) => {
            update(req, res, next, req.params.id, (body) => {
                return removeIllegalAttributes(body);
            });
        });

        router.delete('/:id', (req, res, next) => {
            const attachReply = _attachReply.bind(null, req, res, next);
            const handleError = _handleError.bind(null, next);

            model.destroy({where: {id: req.params.id}}).then(affectedRows => {
                if (affectedRows === 0) return _createErrorPromise(404);
                return attachReply(204);
            }).catch(err => {
                return handleError(err);
            });
        });

        getAssociatedModelNames(model).forEach(associationName => {
            const association = getAssociationByName(associationName);
            const target = association.target;
            const source = association.source;
            const removeIllegalTargetAttributes = _removeIllegalAttributes.bind(null, target);
            const fillMissingUpdateableTargetAttributes = _fillMissingUpdateableAttributes.bind(null, target);

            const unlinkRelations = (req, res, next, setterFunctionName) => {
                const attachReply = _attachReply.bind(null, req, res, next);
                const handleError = _handleError.bind(null, next);

                source.findById(req.params.id).then(sourceInstance => {
                    if (!sourceInstance) return _createErrorPromise(404, 'source not found.');
                    return sourceInstance[setterFunctionName](null).then(sourceInstance => {
                        return attachReply(204);
                    });
                }).catch(err => {
                    return handleError(err);
                });
            }

            // TODO: add "as" support
            switch (association.associationType) {
                case 'HasOne':
                case 'BelongsTo':
                    router.get(`/:id/${target.name}`, (req, res, next) => {
                        const attachReply = _attachReply.bind(null, req, res, next);
                        const handleError = _handleError.bind(null, next);

                        source.findById(req.params.id).then(sourceInstance => {
                            if (!sourceInstance) return _createErrorPromise(404, 'source not found.');
                            return sourceInstance[`get${target.name}`]().then(targetInstance => {
                                if (!targetInstance) return _createErrorPromise(404, 'target not found.');
                                return attachReply(200, targetInstance.get({plain: true}));
                            });
                        }).catch(err => {
                            return handleError(err);
                        });
                    });
                    router.post(`/:id/${target.name}`, (req, res, next) => {
                        const attachReply = _attachReply.bind(null, req, res, next);
                        const handleError = _handleError.bind(null, next);
                        source.findById(req.params.id).then(sourceInstance => {
                            if (!sourceInstance) return _createErrorPromise(404, 'source not found.');
                            return sourceInstance[`create${target.name}`](removeIllegalTargetAttributes(req.body));
                        }).then(instance => {
                            if (association.associationType === 'BelongsTo') {
                                return instance[`get${target.name}`]().then(createdTargetInstance => {
                                    return attachReply(201, createdTargetInstance.get({plain: true}));
                                });
                            } else {
                                return attachReply(201, instance.get({plain: true}));
                            }
                        }).catch(err => {
                            return handleError(err);
                        });
                    });
                    router.put(`/:id/${target.name}`, (req, res, next) => {
                        _updateRelation(source, target, association.associationType, req, res, next, req.params.id, null, (body) => {
                            return fillMissingUpdateableTargetAttributes(removeIllegalTargetAttributes(body));
                        });
                    });
                    router.patch(`/:id/${target.name}`, (req, res, next) => {
                        _updateRelation(source, target, association.associationType, req, res, next, req.params.id, null, (body) => {
                            return removeIllegalTargetAttributes(body);
                        });
                    });
                    router.delete(`/:id/${target.name}`, (req, res, next) => {
                        unlinkRelations(req, res, next, `set${target.name}`)
                    });
                    break;
                case 'HasMany':
                case 'BelongsToMany':
                    router.get(`/:id/${target.name}`, (req, res, next) => {
                        const attachReply = _attachReply.bind(null, req, res, next);
                        const handleError = _handleError.bind(null, next);

                        source.findById(req.params.id).then(sourceInstance => {
                            if (!sourceInstance) return _createErrorPromise(404, 'source not found.');
                            sourceInstance[`get${target.name}s`]().then(targetInstances => {
                                if (!targetInstances) return _createErrorPromise(404, 'target not found.');
                                return attachReply(200, targetInstances.map(targetInstance => targetInstance.get({plain: true})));
                            }).catch(err => {
                                return handleError(err);
                            });
                        });
                    });
                    router.get(`/:id/${target.name}/:targetId`, (req, res, next) => {
                        const attachReply = _attachReply.bind(null, req, res, next);
                        const handleError = _handleError.bind(null, next);

                        source.findById(req.params.id).then(sourceInstance => {
                            if (!sourceInstance) return _createErrorPromise(404, 'source not found.');
                            sourceInstance[`get${target.name}s`]({where: {id: {$eq: req.params.targetId}}}).spread(targetInstance => {
                                if (!targetInstance) return _createErrorPromise(404, 'target not found.');
                                return attachReply(200, targetInstance.get({plain: true}));
                            }).catch(err => {
                                return handleError(err);
                            });
                        });
                    });
                    router.post(`/:id/${target.name}`, (req, res, next) => {
                        const attachReply = _attachReply.bind(null, req, res, next);
                        const handleError = _handleError.bind(null, next);
                        source.findById(req.params.id).then(sourceInstance => {
                            if (!sourceInstance) return _createErrorPromise(404, 'source not found.');
                            return sourceInstance[`create${target.name}`](removeIllegalTargetAttributes(req.body));
                        }).then(instance => {
                            return attachReply(201, instance.get({plain: true}));
                        }).catch(err => {
                            return handleError(err);
                        });
                    });
                    router.put(`/:id/${target.name}/:targetId`, (req, res, next) => {
                        _updateRelation(source, target, association.associationType, req, res, next, req.params.id, req.params.targetId, (body) => {
                            return fillMissingUpdateableTargetAttributes(removeIllegalTargetAttributes(body));
                        });
                    });
                    router.patch(`/:id/${target.name}/:targetId`, (req, res, next) => {
                        _updateRelation(source, target, association.associationType, req, res, next, req.params.id, req.params.targetId, (body) => {
                            return removeIllegalTargetAttributes(body);
                        });
                    });
                    router.delete(`/:id/${target.name}`, (req, res, next) => {
                        unlinkRelations(req, res, next, `set${target.name}s`)
                    });
                    router.delete(`/:id/${target.name}/:targetId`, (req, res, next) => {
                        const attachReply = _attachReply.bind(null, req, res, next);
                        const handleError = _handleError.bind(null, next);

                        source.findById(req.params.id).then(sourceInstance => {
                            if (!sourceInstance) return _createErrorPromise(404, 'source not found.');
                            return sourceInstance[`get${target.name}s`]({where: {id: req.params.targetId}}).then(targetInstances => {
                                const targetInstance = targetInstances[0];
                                if (!targetInstance) return _createErrorPromise(404, 'target not found.');
                                return sourceInstance[`remove${target.name}`](targetInstance);
                            }).then(() => {
                                return attachReply(204);
                            });
                        }).catch(err => {
                            return handleError(err);
                        });
                    });
                    break;
            };
        });
    });
    return routingInformation.map(routing => {
        return {route: '/' + routing.route, router: routing.router}
    });
};