'use strict';

const express = require('express');
const sequelize = require('sequelize');
const _ = require('lodash');

const routingInformation = [];

const _attachReply = (req, res, next, statusCode, result, message) => {
    const err = new Error();
    err.success = true;
    err.statusCode = statusCode;
    err.result = result;
    err.message = message;
    return Promise.reject(err);
};

const _createError = (req, res, next, statusCode, err, message) => {
    err = err || new Error();
    err.success = false;
    err.statusCode = statusCode;
    err.message = message;
    return err;
};

const _formatValidationError = (err) => {
    return err.errors.map(error => {
        return _.pick(error, ['type', 'path', 'value']);
    });
};

const _handleUnexpectedError = (req, res, next, err) => {
    if (err.success) {
        req.custom = {
            statusCode: err.statusCode,
            result: err.result,
            message: err.message
        };
        next();
    } else {
        if (err instanceof sequelize.ValidationError)
            return next(_createError(req, res, next, 400, _formatValidationError(err)));
        else
            return next(_createError(req, res, next, 500, err));
    }
};

const _getUpdateableAttributes = (model) => {
    return _.pull(_.keys(model.attributes), 'id', 'updatedAt', 'createdAt', 'deletedAt')
        .filter(attribute => !model.attributes[attribute].references)
        .map(attribute => {
            const allowNull = model.attributes[attribute].allowNull;
            return { attribute, allowNull: allowNull === undefined || allowNull === true }
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
    return (_.find(routingInformation, (i) => i.model.model.name === model.name) || { router: null }).router;
};


const _update = (model, req, res, next, id, createInput) => {
    const attachReply = _attachReply.bind(null, req, res, next);
    const handleUnexpectedError = _handleUnexpectedError.bind(null, req, res, next);

    const attributes = _getUpdateableAttributes(model).map(attribute => attribute.attribute);
    model.update(createInput(req.body), { where: { id }, fields: attributes }).spread((affectedCount, affectedRows) => {
        if (affectedCount === 0) return attachReply(404);
        return attachReply(204);
    }).catch(err => {
        return handleUnexpectedError(err);
    });
};

module.exports = (models) => {
    if (!models) throw new Error('models must be set!');
    if (!(models instanceof Array)) throw new Error('models must be an array');

    // first pass, register all models
    models.forEach(model => {
        if (_.find(routingInformation, (i) => i.model.model.name === model.model.name))
            throw new Error(`model ${model.model.name} already registered`);
        const router = express.Router();
        routingInformation.push({
            model,
            route: model.model.name,
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
            const handleUnexpectedError = _handleUnexpectedError.bind(null, req, res, next);
            const input = removeIllegalAttributes(req.body);

            model
                .create(input)
                .then(modelInstance => {
                    return attachReply(201, modelInstance.get({ plain: true }));
                }).catch(err => {
                    return handleUnexpectedError(err);
                });
        });

        router.get('/', (req, res, next) => {
            const attachReply = _attachReply.bind(null, req, res, next);
            const handleUnexpectedError = _handleUnexpectedError.bind(null, req, res, next);

            // TODO: search

            const limit = req.query.i;
            const offset = req.query.p;
            const attributes = req.query.a ? req.query.a.split('|') : undefined;
            const sortField = req.query.f;
            const sortOrder = req.query.o || 'DESC';


            Promise.resolve().then(() => {
                if (sortOrder !== 'DESC' && sortOrder !== 'ASC')
                    return attachReply(400, undefined, 'invalid sort order, must be DESC or ASC');

                if ((!limit || !offset) && limit !== offset)
                    return attachReply(400, undefined, 'p or i must be both undefined or both defined.');

                const limitInt = parseInt(limit);
                const offsetInt = parseInt(offset);

                if (((limit && (isNaN(limitInt))) || limitInt < 1) ||
                    ((offset && (isNaN(offsetInt))) || offsetInt < 1))
                    return attachReply(400, undefined, 'p or i must be integers larger than 1!');

                const order = sortField ? [[sortField, sortOrder]] : undefined;
                return model.findAll({ limit: limitInt, offset: limitInt * offsetInt, attributes, order });
            }).then(modelInstances => {
                const result = modelInstances.map(instance => instance.get({ plain: true }));
                return attachReply(200, result);
            }).catch(err => {
                return handleUnexpectedError(err);
            });
        });

        router.get('/:id', (req, res, next) => {
            const attachReply = _attachReply.bind(null, req, res, next);
            const handleUnexpectedError = _handleUnexpectedError.bind(null, req, res, next);

            const attributes = req.query.a ? req.query.a.split('|') : undefined;
            model.findOne({ where: { id: req.params.id }, attributes }).then(modelInstance => {
                return attachReply(200, modelInstance);
            }).catch(err => {
                return handleUnexpectedError(err);
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
            const handleUnexpectedError = _handleUnexpectedError.bind(null, req, res, next);

            model.destroy({ where: { id: req.params.id } }).then(affectedRows => {
                if (affectedRows === 0) return attachReply(404);
                return attachReply(204);
            }).catch(err => {
                return handleUnexpectedError(err);
            });
        });

        getAssociatedModelNames(model).forEach(associationName => {
            const association = getAssociationByName(associationName);
            const target = association.target;
            const source = association.source;
            const removeIllegalTargetAttributes = _removeIllegalAttributes.bind(null, target);
            const removeIllegalSourceAttributes = _removeIllegalAttributes.bind(null, source);

            // TODO: add "as" support
            switch (association.associationType) {
                case 'HasOne':
                case 'BelongsTo':
                    router.get(`/:id/${target.name}`, (req, res, next) => {
                        const attachReply = _attachReply.bind(null, req, res, next);
                        const handleUnexpectedError = _handleUnexpectedError.bind(null, req, res, next);

                        source.findById(req.params.id).then(sourceInstance => {
                            if (!sourceInstance) return attachReply(404, undefined, 'source not found.');
                            return sourceInstance[`get${target.name}`]().then(targetInstance => {
                                if (!targetInstance) return attachReply(404, undefined, 'target not found.');
                                return attachReply(200, targetInstance.get({ plain: true }));
                            });
                        }).catch(err => {
                            return handleUnexpectedError(err);
                        });
                    });
                    router.post(`/:id/${target.name}`, (req, res, next) => {
                        const attachReply = _attachReply.bind(null, req, res, next);
                        const handleUnexpectedError = _handleUnexpectedError.bind(null, req, res, next);
                        source.findById(req.params.id).then(sourceInstance => {
                            if (!sourceInstance) return attachReply(404, undefined, 'source not found.');
                            return sourceInstance[`create${target.name}`](removeIllegalTargetAttributes(req.body));
                        }).then(instance => {
                            if (association.associationType === 'BelongsTo') {
                                return instance[`get${target.name}`]().then(createdTargetInstance => {
                                    return attachReply(201, createdTargetInstance.get({ plain: true }));
                                });
                            } else {
                                return attachReply(201, instance.get({ plain: true }));
                            }
                        }).catch(err => {
                            return handleUnexpectedError(err);
                        });
                    });
                    router.put(`/:id/${target.name}`, (req, res, next) => {
                        const body = req.body;

                        const removeIllegalAttributes = _removeIllegalAttributes.bind(null, target);
                        const fillMissingUpdateableAttributes = _fillMissingUpdateableAttributes.bind(null, target);

                        const attachReply = _attachReply.bind(null, req, res, next);
                        const handleUnexpectedError = _handleUnexpectedError.bind(null, req, res, next);

                        source.findById(req.params.id).then(sourceInstance => {
                            const update = _update.bind(null, target);
                            if (!sourceInstance) return attachReply(404, undefined, 'source not found.');
                            return sourceInstance[`get${target.name}`]().then(targetInstance => {
                                if (!targetInstance)
                                    return attachReply(404, undefined, 'target not found.');
                                update(req, res, next, targetInstance.get({ playn: true }).id, (body) => {
                                    return fillMissingUpdateableAttributes(removeIllegalAttributes(body));
                                });
                            });
                        }).catch(err => {
                            return handleUnexpectedError(err);
                        });
                    });
                    router.patch(`/:id/${target.name}`, (req, res, next) => {
                    });
                    router.delete(`/:id/${target.name}`, (req, res, next) => {
                        // TODO: currently, deleting only dereferences but leaves the actual data in the database. we should allow complete deletion of hasOne 
                        const attachReply = _attachReply.bind(null, req, res, next);
                        const handleUnexpectedError = _handleUnexpectedError.bind(null, req, res, next);

                        source.findById(req.params.id).then(sourceInstance => {
                            if (!sourceInstance) return attachReply(404, undefined, 'source not found.');
                            return sourceInstance[`set${target.name}`](null).then(sourceInstance => {
                                return attachReply(204);
                            });
                        }).catch(err => {
                            return handleUnexpectedError(err);
                        });
                    });
                    break;
            };
            //console.log(_.keys(association))
            //console.dir(association)
        });
    });
    return routingInformation.map(routing => {
        return { route: '/' + routing.route, router: routing.router }
    });
};