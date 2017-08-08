'use strict';

const request = require('supertest');
const expect = require('chai').expect;
const Promise = require('bluebird');
const rewire = require('rewire');

const database = require('./database');
const testModel = require('./model/test');
const TestModel = testModel(database.sequelize, database.Sequelize);
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const _esg = rewire('../index.js');
const esg = require('../index');

const _getUpdateableAttributes = _esg.__get__('_getUpdateableAttributes');
const _removeIllegalAttributes = _esg.__get__('_removeIllegalAttributes');
const _fillMissingUpdateableAttributes = _esg.__get__('_fillMissingUpdateableAttributes');

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
                testModelPromises.push(TestModel.create({ value1: 'test' + i, value2: i, value3: 'no null!' }));
            }
            return Promise.all(testModelPromises);
        });
    });

    afterEach(() => {
        return database.reset();
    });

    describe('_getUpdateableAttributes', () => {
        it('should return a list of all attributes, without fields that are managed by the ORM or the database.', () => {
            expect(_getUpdateableAttributes(TestModel)).to.deep.equal([
                { attribute: 'value1', allowNull: true },
                { attribute: 'value2', allowNull: true },
                { attribute: 'value3', allowNull: false }]);
        });
    });

    describe('_removeIllegalAttributes', () => {
        it('should remove illegal arguments.', () => {
            expect(_removeIllegalAttributes(TestModel, { this: 1, is: 1, a: 1, test: 1 })).to.deep.equal({});
        });
        it('should retain legal arguments.', () => {
            expect(_removeIllegalAttributes(TestModel, { this: 1, is: 1, a: 1, test: 1, value1: 'should stay' })).to.deep.equal({ value1: 'should stay' });
        });
    });

    describe('_fillMissingUpdateableAttributes', () => {
        it('should fill up missing model members with null.', () => {
            expect(_fillMissingUpdateableAttributes(TestModel, {})).to.deep.equal({
                value1: null,
                value2: null,
                value3: null
            });
        });
        it('should not overwrite existing members.', () => {
            expect(_fillMissingUpdateableAttributes(TestModel, { value1: 'test' })).to.deep.equal({
                value1: 'test',
                value2: null,
                value3: null
            });
        });
    });

    describe('/model POST', () => {
        it('should create an instance.', () => {
            return request(app)
                .post('/test')
                .send({ value1: 'test1', value2: 1 })
                .expect(201)
                .then(response => {
                    expect(response.body.result.value1).to.equal('test1');
                    expect(response.body.result.value2).to.equal(1);
                });
        });

        it('should create a validation error.', () => {
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
        it('should validate that offset and limit are both set if one is set.', () => {
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
        it('should validate that offset and limit are integers.', () => {
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
    describe('/model/:id GET', () => {
        it('should return an item by id.', () => {
            return request(app)
                .get('/test/1')
                .expect(200)
                .then(response => {
                    expect(response.body.result.id).to.equal(1);
                });
        });
        it('should only return the specified attributes.', () => {
            return request(app)
                .get('/test/1?a=value1')
                .expect(200)
                .then(response => {
                    expect(response.body).to.deep.equal({ result: { value1: 'test0' } });
                });
        });
    });
    describe('/model/:id DELETE', () => {
        it('should delete an instance.', () => {
            return request(app)
                .delete('/test/1')
                .expect(204)
                .then(response => {
                    return TestModel.findOne({ where: { id: 1 } }).then(instance => {
                        expect(instance).to.not.exist;
                    });
                });
        });
        it('should inform callers that an instance does not exist.', () => {
            return request(app)
                .delete('/test/0')
                .expect(404)
                .then(response => {
                });
        });
    });
    describe('/model/:id PUT', () => {
        it('should replace an instance.', () => {
            return request(app)
                .put('/test/1')
                .send({ value3: 'changed' })
                .expect(204)
                .then(response => {
                    return TestModel.findOne({ where: { id: 1 } }).then(instance => {
                        const result = instance.get({ plain: true })
                        expect(result.value1).to.be.null;
                        expect(result.value2).to.be.null;
                        expect(result.value3).to.equal('changed');
                    });
                });
        });
        it('should inform callers that an instance does not exist.', () => {
            return request(app)
                .put('/test/0')
                .send({value3: 'changed'})
                .expect(404);
        });
    });
});
