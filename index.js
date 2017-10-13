'use strict';

const express = require('express');
const sequelize = require('sequelize');
const _ = require('lodash');

const routingInformation = {};

const _attachReply = (req, res, next, statusCode, result, message) => {
    // TODO: check if required fields are set!
    req.custom = {
        statusCode,
        result,
        message
    };
    return next();
};

const _attachErrorReply = (req, res, next, statusCode, result, message) => {
    return next({
        statusCode,
        result,
        message
    });
};

const _formatValidationError = (err) => {
    return err.errors.map(error => {
        return _.pick(error, ['type', 'path', 'value']);
    });
};

const _handleUnexpectedError = (req, res, next, err) => {
    if (err instanceof sequelize.ValidationError) return _attachErrorReply(req, res, next, 400, _formatValidationError(err));
    _attachErrorReply(req, res, next, 500, err);
};

const _getUpdateableAttributes = (model) => {
    return _.pull(_.keys(model.attributes), 'id', 'updatedAt', 'createdAt', 'deletedAt').map(attribute => {
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

module.exports = (model, opts) => {
    if (!model) throw new Error('model must be set!');
    if (routingInformation[model.name])
        throw new Error('model "' + model.name + '" already registered!');
    opts = opts || {};

    const router = express.Router();

    const removeIllegalAttributes = _removeIllegalAttributes.bind(null, model);
    const fillMissingUpdateableAttributes = _fillMissingUpdateableAttributes.bind(null, model);
    const getAssociatedModelNames = _getAssociatedModelNames.bind(null, model);
    const getAssociationByName = _getAssociationByName.bind(null, model);

    router.post('/', (req, res, next) => {
        const attachReply = _attachReply.bind(null, req, res, next);
        const handleUnexpectedError = _handleUnexpectedError.bind(null, req, res, next);
        const input = removeIllegalAttributes(req.body);

        model
            .create(input)
            .then(modelInstance => {
                attachReply(201, modelInstance.get({ plain: true }));
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
        model
            .findAll({ limit: limitInt, offset: limitInt * offsetInt, attributes, order })
            .then(modelInstances => {
                const result = modelInstances.map(instance => instance.get({ plain: true }));
                attachReply(200, result);
            }).catch(err => {
                return handleUnexpectedError(err);
            });
    });

    router.get('/:id', (req, res, next) => {
        const attachReply = _attachReply.bind(null, req, res, next);
        const handleUnexpectedError = _handleUnexpectedError.bind(null, req, res, next);

        const attributes = req.query.a ? req.query.a.split('|') : undefined;
        model.findOne({ where: { id: req.params.id }, attributes }).then(modelInstance => {
            attachReply(200, modelInstance);
        }).catch(err => {
            return handleUnexpectedError(err);
        });
    });

    const update = (req, res, next, createInput) => {
        const attachReply = _attachReply.bind(null, req, res, next);
        const handleUnexpectedError = _handleUnexpectedError.bind(null, req, res, next);

        const attributes = _getUpdateableAttributes(model).map(attribute => attribute.attribute);

        model.update(createInput(req.body), { where: { id: req.params.id }, fields: attributes }).spread((affectedCount, affectedRows) => {
            if (affectedCount === 0) return attachReply(404);
            return attachReply(204);
        }).catch(err => {
            return handleUnexpectedError(err);
        });
    };

    router.put('/:id', (req, res, next) => {
        update(req, res, next, (body) => {
            return fillMissingUpdateableAttributes(removeIllegalAttributes(body));
        });
    });

    router.patch('/:id', (req, res, next) => {
        update(req, res, next, (body) => {
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

        switch (association.associationType) {
            case 'BelongsTo':
                router.get('/:id/' + target.name, (req, res, next) => {
                    const attachReply = _attachReply.bind(null, req, res, next);                    
                    source.get[target.name].then(targetInstance => {
                        return attachReply(200, result);
                    }).catch(err => {
                        return handleUnexpectedError(err);
                    });
                });
                break;
        };
        //console.log(_.keys(association))
        //console.dir(association)
    });

    routingInformation[model.name] = router;

    return ['/' + model.name, router];
};