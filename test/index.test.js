'use strict';

const request = require('supertest');
const expect = require('chai').expect;

const database = require('./database');
const testModel = require('./model/test');
const TestModel = testModel(database.sequelize, database.Sequelize);
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const esg = require('../index');

describe('index.js', () => {

    before(done => {
        app.use(bodyParser.json({}));
        app.use('/test', esg(TestModel))
        // simple response handler
        app.use((req, res) => {
            res.status(req.custom.statusCode).send({ result: req.custom.result, message: req.custom.message });
        });
        // simple error handler
        app.use((err, req, res, next) => {
            res.status(err.statusCode).send({ result: err.result });
        });
        done();
    });

    beforeEach(() => {
        return database.init();
    });

    afterEach(() => {
        return database.reset();
    });

    it('/model POST - should create an instance', () => {
        return request(app)
            .post('/test')
            .send({ value1: 'test1', value2: 1 })
            .expect(201)
            .then(response => {
                expect(response.body.result.value1).to.equal('test1');
                expect(response.body.result.value2).to.equal(1);
            });
    });

    it('/model POST - should create a validation error', () => {
        return request(app)
            .post('/test')
            .send({ value1: 'test1', value2: 50 })
            .expect(400)
            .then(response => {
                expect(response.body.result).to.deep.equal([{ type: 'Validation error', path: 'value2', value: 50 }]);
            });
    });
});