'use strict';

const express = require('express');
const sequelize = require('sequelize');
const _ = require('lodash');

module.exports = (model, opts) => {
    if (!model) throw new Error('model must be set!');
    opts = opts || {};

    const router = express.Router();
    const route = opts.route || model.name;

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

    const _getUpdateableAttributes = (model) => {
        return _.pull(_.keys(model.attributes), 'id', 'updatedAt', 'createdAt', 'deletedAt').map(attribute => {
            return {attribute, allowNull: model.attributes[attribute].allowNull}
        });
    };

    const _create = () => {

    };

    router.post('/', (req, res, next) => {
        const attachReply = _attachReply.bind(null, req, res, next);
        const attachErrorReply = _attachErrorReply.bind(null, req, res, next);

        model
            .create(req.body)
            .then(modelInstance => {
                attachReply(201, modelInstance.get({ plain: true }));
            }).catch(err => {
                if (err instanceof sequelize.ValidationError) return attachErrorReply(400, _formatValidationError(err));
                return attachErrorReply(500, err);
            });
    });

    router.get('/', (req, res, next) => {
        const attachReply = _attachReply.bind(null, req, res, next);
        const attachErrorReply = _attachErrorReply.bind(null, req, res, next);

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
                attachErrorReply(500, err);
            });
    });

    router.get('/:id', (req, res, next) => {
        const attachReply = _attachReply.bind(null, req, res, next);
        const attachErrorReply = _attachErrorReply.bind(null, req, res, next);

        const attributes = req.query.a ? req.query.a.split('|') : undefined;
        model.findOne({ where: { id: req.params.id }, attributes }).then(modelInstance => {
            attachReply(200, modelInstance);
        }).catch(err => {
            attachErrorReply(500, err);
        });
    });

    router.put('/:id', (req, res, next) => {
        const attachReply = _attachReply.bind(null, req, res, next);
        const attachErrorReply = _attachErrorReply.bind(null, req, res, next);

        const attributes = _getUpdateableAttributes(model);

        model.update(req.body, { where: { id: req.params.id }, fields: attributes }).spread((affectedCount, affectedRows) => {
            if (affectedCount === 0) return attachReply(404);
            return attachReply(204);
        }).catch(err => {
            return attachErrorReply(500, err);
        });
    });

    router.patch('/:id', (req, res, next) => {

    });

    router.delete('/:id', (req, res, next) => {
        const attachReply = _attachReply.bind(null, req, res, next);
        const attachErrorReply = _attachErrorReply.bind(null, req, res, next);

        model.destroy({ where: { id: req.params.id } }).then(affectedRows => {
            if (affectedRows === 0) return attachReply(404);
            return attachReply(204);
        }).catch(err => {
            return attachErrorReply(500, err);
        });
    });

    return router;
};