'use strict';

const request = require('supertest');
const expect = require('chai').expect;
const Promise = require('bluebird');

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
        return database.init().then(() => {
            const testModelPromises = [];
            for (let i = 0; i < 49; i++) {
                testModelPromises.push(TestModel.create({ value1: 'test' + i, value2: i }));
            }
            return Promise.all(testModelPromises);
        });
    });

    afterEach(() => {
        return database.reset();
    });

    describe('/model POST', () => {
        it('should create an instance', () => {
            return request(app)
                .post('/test')
                .send({ value1: 'test1', value2: 1 })
                .expect(201)
                .then(response => {
                    expect(response.body.result.value1).to.equal('test1');
                    expect(response.body.result.value2).to.equal(1);
                });
        });

        it('should create a validation error', () => {
            return request(app)
                .post('/test')
                .send({ value1: 'test1', value2: 101 })
                .expect(400)
                .then(response => {
                    expect(response.body.result).to.deep.equal([{ type: 'Validation error', path: 'value2', value: 101 }]);
                });
        });
    });

    describe('/model GET', () => {
        it('should validate that offset and limit are both set if one is set', () => {
            return Promise.join(
                request(app)
                    .get('/test?p=1')
                    .expect(400)
                    .then(response => {
                        expect(response.body).to.deep.equal({ message: 'p or i must be both undefined or both defined.' });
                    }),
                request(app)
                    .get('/test?i=1')
                    .expect(400)
                    .then(response => {
                        expect(response.body).to.deep.equal({ message: 'p or i must be both undefined or both defined.' });
                    })
            );
        });
        it('should validate that offset and limit are integers', () => {
            return Promise.join(
                request(app)
                    .get('/test?p=test&i=1')
                    .expect(400)
                    .then(response => {
                        expect(response.body).to.deep.equal({ message: 'p or i must be integers larger than 1!' });
                    }),
                request(app)
                    .get('/test?i=test&p=1')
                    .expect(400)
                    .then(response => {
                        expect(response.body).to.deep.equal({ message: 'p or i must be integers larger than 1!' });
                    }),
                request(app)
                    .get('/test?i=-1&p=1')
                    .expect(400)
                    .then(response => {
                        expect(response.body).to.deep.equal({ message: 'p or i must be integers larger than 1!' });
                    }),
                request(app)
                    .get('/test?p=1&i=-1')
                    .expect(400)
                    .then(response => {
                        expect(response.body).to.deep.equal({ message: 'p or i must be integers larger than 1!' });
                    })
            );
        });
        it('should paginate according to offset and limit.', () => {
            return request(app)
                .get('/test?p=1&i=10')
                .expect(200)
                .then(response => {
                    expect(response.body.result.length).to.equal(10);
                    expect(response.body.result[0].id).to.equal(11);
                    expect(response.body.result[response.body.result.length - 1].id).to.equal(20);
                });
        });
        it('should only show attributes that have been specified.', () => {
            return request(app)
                .get('/test?a=value1&p=1&i=1')
                .expect(200)
                .then(response => {
                    expect(response.body).to.deep.equal({ result: [{ value1: 'test1' }] });
                });
        });
        it('should not allow invalid sort orders.', () => {
            return request(app)
                .get('/test?p=1&i=10&f=value1&o=INVALID')
                .expect(400)
                .then(response => {
                    expect(response.body).to.deep.equal({ message: 'invalid sort order, must be DESC or ASC' });
                });
        });
        it('should sort according to given order and field.', () => {
            return request(app)
                .get('/test?p=1&i=10&f=value1&o=ASC')
                .expect(200)
                .then(response => {
                    expect(response.body.result[0].id).to.equal(19);
                    expect(response.body.result[1].id).to.equal(20);
                    expect(response.body.result[2].id).to.equal(3);
                });
        });
    });
});