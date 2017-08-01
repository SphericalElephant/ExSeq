'use strict';

const express = require('express');

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

    router.post('/', (req, res, next) => {
        const attachReply = _attachReply.bind(null, req, res, next);
        const attachErrorReply = _attachErrorReply.bind(null, req, res, next);

        model
            .create(req.body)
            .then(modelInstance => {
                attachReply(201, modelInstance.get({ plain: true }));
            }).catch(err => {
                // TODO: validation errors cause different exception
                attachErrorReply(500, err);
            });
    });

    router.get('/', (req, res, next) => {
        const attachReply = _attachReply.bind(null, req, res, next);
        const attachErrorReply = _attachErrorReply.bind(null, req, res, next);

        const limit = req.query.p;
        const offset = req.query.i;
        const attributes = (req.query.a || '').split('|');
        const order = [(req.query.s || '').split('|')];

        if ((!limit || !offset) && limit !== offset)
            return attachReply(400, undefined, 'p or i must be both undefined or both defined.');

        if ((limit && isNaN(parseInt(limit))) || (offset && isNaN(parseInt(offset))))
            return attachReply(400, undefined, 'p or i are not a number!');

        model
            .findAll({ limit, offset, attributes, order })
            .then(modelInstances => {
            }).catch(err => {
                attachErrorReply(500, err);
            });
    });

    router.get('/:id', (req, res, next) => {

    });

    router.put('/:id', (req, res, next) => {

    });

    router.patch('/:id', (req, res, next) => {

    });

    router.delete('/:id', (req, res, next) => {

    });

    return router;
};