'use strict';

const express = require('express');

module.exports = (model, opts) => {
    const router = express.Router();

    if (!model) throw new Error('model must be set!');

    const route = opts.route || model.name;

    const _attachReply = (req, res, next, statusCode, result) => {
        req.custom = {
            statusCode,
            result
        };
        return next();
    };

    router.post('/', (req, res, next) => {
        const attachReply = _attachReply(req, res, next);
        model
            .create(req.body)
            .then(modelInstance => {
                attachReply(201, modelInstance.get({ plain: true }));
            }).catch(err => {
                attachReply(500, modelInstance.get({ plain: true }));
            });
    });

    router.get('/', (req, res, next) => {
        const startPage = req.query.p;
        const itemsPerPage = req.query.i || 10;

        const attachReply = _attachReply(req, res, next);


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