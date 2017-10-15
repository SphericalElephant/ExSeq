'use strict';

const request = require('supertest');
const expect = require('chai').expect;
const Promise = require('bluebird');
const rewire = require('rewire');

const database = require('./database');
const testModel = require('./model/test-model');
const TestModel = testModel(database.sequelize, database.Sequelize);
const testModel2 = require('./model/test-model2');
const TestModel2 = testModel2(database.sequelize, database.Sequelize);
const testModel3 = require('./model/test-model3');
const TestModel3 = testModel3(database.sequelize, database.Sequelize);
TestModel2.belongsTo(TestModel);
TestModel.hasOne(TestModel3);
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

        esg([
            { model: TestModel, opts: {} },
            { model: TestModel2, opts: {} }
        ]).forEach((routing) => {
            app.use(routing.route, routing.router);
        });

        // simple response handler
        app.use((req, res) => {
            return res.status(req.custom.statusCode).send({ result: req.custom.result, message: req.custom.message });
        });
        // simple error handler
        app.use((err, req, res, next) => {
            console.log(err);
            if (!err.statusCode) {
                return res.status(500).send({ result: err.stack })
            };
            return res.status(err.statusCode).send({ result: err.result });
        });
        done();
    });

    beforeEach(() => {
        return database.init().then(() => {
            const testModelPromises = [];
            for (let i = 0; i < 49; i++) {
                testModelPromises.push(
                    TestModel.create({ value1: 'test' + i, value2: i, value3: 'no null!' }).then(testModel => {
                        return Promise.join(
                            TestModel2.create().then(testModel2 => {
                                return testModel2.setTestModel(testModel);
                            }),
                            TestModel3.create().then(testModel3 => {
                                return testModel.setTestModel3(testModel3);
                            })
                        );
                    })
                );
            }
            testModelPromises.push(TestModel2.create({ value1: 'addrelationTestModel2' }));
            testModelPromises.push(TestModel.create({ value1: 'addrelationTestModel', value2: 1, value3: 'no null!' }));
            return Promise.all(testModelPromises);
        });
    });

    afterEach(() => {
        return database.reset();
    });

    describe('esg', () => {
        it('should not allow registering the same model twice', () => {
            expect(esg.bind(null, [{ model: TestModel }, { model: TestModel }])).to.throw('already registered');
        });
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
                .post('/TestModel')
                .send({ value1: 'test1', value2: 1, value3: 'not null' })
                .expect(201)
                .then(response => {
                    expect(response.body.result.value1).to.equal('test1');
                    expect(response.body.result.value2).to.equal(1);
                });
        });

        it('should create a validation error.', () => {
            return request(app)
                .post('/TestModel')
                .send({ value1: 'test1', value2: 101, value3: 'not null' })
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
                    .get('/TestModel?p=1')
                    .expect(400)
                    .then(response => {
                        expect(response.body).to.deep.equal({ message: 'p or i must be both undefined or both defined.' });
                    }),
                request(app)
                    .get('/TestModel?i=1')
                    .expect(400)
                    .then(response => {
                        expect(response.body).to.deep.equal({ message: 'p or i must be both undefined or both defined.' });
                    })
            );
        });
        it('should validate that offset and limit are integers.', () => {
            return Promise.join(
                request(app)
                    .get('/TestModel?p=test&i=1')
                    .expect(400)
                    .then(response => {
                        expect(response.body).to.deep.equal({ message: 'p or i must be integers larger than 1!' });
                    }),
                request(app)
                    .get('/TestModel?i=test&p=1')
                    .expect(400)
                    .then(response => {
                        expect(response.body).to.deep.equal({ message: 'p or i must be integers larger than 1!' });
                    }),
                request(app)
                    .get('/TestModel?i=-1&p=1')
                    .expect(400)
                    .then(response => {
                        expect(response.body).to.deep.equal({ message: 'p or i must be integers larger than 1!' });
                    }),
                request(app)
                    .get('/TestModel?p=1&i=-1')
                    .expect(400)
                    .then(response => {
                        expect(response.body).to.deep.equal({ message: 'p or i must be integers larger than 1!' });
                    })
            );
        });
        it('should paginate according to offset and limit.', () => {
            return request(app)
                .get('/TestModel?p=1&i=10')
                .expect(200)
                .then(response => {
                    expect(response.body.result.length).to.equal(10);
                    expect(response.body.result[0].id).to.equal(11);
                    expect(response.body.result[response.body.result.length - 1].id).to.equal(20);
                });
        });
        it('should only show attributes that have been specified.', () => {
            return request(app)
                .get('/TestModel?a=value1&p=1&i=1')
                .expect(200)
                .then(response => {
                    expect(response.body).to.deep.equal({ result: [{ value1: 'test1' }] });
                });
        });
        it('should not allow invalid sort orders.', () => {
            return request(app)
                .get('/TestModel?p=1&i=10&f=value1&o=INVALID')
                .expect(400)
                .then(response => {
                    expect(response.body).to.deep.equal({ message: 'invalid sort order, must be DESC or ASC' });
                });
        });
        it('should sort according to given order and field.', () => {
            return request(app)
                .get('/TestModel?p=1&i=10&f=value1&o=ASC')
                .expect(200)
                .then(response => {
                    expect(response.body.result[0].id).to.equal(18);
                    expect(response.body.result[1].id).to.equal(19);
                    expect(response.body.result[2].id).to.equal(20);
                });
        });
    });
    describe('/model/:id GET', () => {
        it('should return an item by id.', () => {
            return request(app)
                .get('/TestModel/1')
                .expect(200)
                .then(response => {
                    expect(response.body.result.id).to.equal(1);
                });
        });
        it('should only return the specified attributes.', () => {
            return request(app)
                .get('/TestModel/1?a=value1')
                .expect(200)
                .then(response => {
                    expect(response.body).to.deep.equal({ result: { value1: 'test0' } });
                });
        });
    });
    describe('/model/:id DELETE', () => {
        it('should delete an instance.', () => {
            return request(app)
                .delete('/TestModel/1')
                .expect(204)
                .then(response => {
                    return TestModel.findOne({ where: { id: 1 } }).then(instance => {
                        expect(instance).to.not.exist;
                    });
                });
        });
        it('should inform callers that an instance does not exist.', () => {
            return request(app)
                .delete('/TestModel/0')
                .expect(404)
                .then(response => {
                });
        });
    });
    describe('/model/:id PUT', () => {
        it('should replace an instance.', () => {
            return request(app)
                .put('/TestModel/1')
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
                .put('/TestModel/0')
                .send({ value3: 'changed' })
                .expect(404);
        });
    });
    describe('/model/:id PATCH', () => {
        it('should update invididual attributes of a record', () => {
            return request(app)
                .patch('/TestModel/1')
                .send({ value3: 'changed' })
                .expect(204)
                .then(response => {
                    return TestModel.findOne({ where: { id: 1 } }).then(instance => {
                        const result = instance.get({ plain: true })
                        expect(result.value1).to.equal('test0');
                        expect(result.value2).to.equal(0);
                        expect(result.value3).to.equal('changed');
                    });
                });
        });
        it('should inform callers that an instance does not exist.', () => {
            return request(app)
                .patch('/TestModel/0')
                .send({ value3: 'changed' })
                .expect(404);
        });
    });
    describe('/model/:id/belongsToRelation/ GET', () => {
        it('should return the belongsTo relation of the requested resource', () => {
            return request(app)
                .get('/TestModel2/1/TestModel/')
                .expect(200)
                .then(response => {
                    expect(response.body.result.id).to.equal(1);
                });
        });

        // TODO: test target not found and source not found
    });
    describe('/model/:id/belongsToRelation/ POST', () => {
        it('should create the belongsTo relation of the resource', () => {
            return TestModel2.findOne({ where: { value1: 'addrelationTestModel2' } }).then(testModelInstance => {
                return request(app)
                    .post(`/TestModel2/${testModelInstance.get({ plain: true }).id}/TestModel/`)
                    .send({
                        value1: 'teststring1',
                        value2: 1,
                        value3: 'teststring2'
                    })
                    .expect(201)
                    .then(response => {
                        expect(response.body.result.value1).to.equal('teststring1');
                        expect(response.body.result.value2).to.equal(1);
                        expect(response.body.result.value3).to.equal('teststring2');
                    });
            });
        });
        // TODO: test source
    });
    describe('/model/:id/hasOneRelation/ GET', () => {
        it('should return the belongsTo relation of the requested resource', () => {
            return request(app)
                .get('/TestModel/1/TestModel3/')
                .expect(200)
                .then(response => {
                    expect(response.body.result.id).to.equal(1);
                    expect(response.body.result.TestModelId).to.equal(1);
                });
        });

        // TODO: test target not found and source not found
    });
    describe('/model/:id/hasOneRleation/ POST', () => {
        it('should create the hasOne relation of the resource', () => {
            return TestModel.findOne({ where: { value1: 'addrelationTestModel' } }).then(testModelInstance => {
                return request(app)
                    .post(`/TestModel/${testModelInstance.get({ plain: true }).id}/TestModel3/`)
                    .send({
                        value1: 'teststring1'
                    })
                    .expect(201)
                    .then(response => {
                        expect(response.body.result.value1).to.equal('teststring1');
                    });
            });
        });
        // TODO: test source
    });
});
