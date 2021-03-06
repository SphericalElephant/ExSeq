/* eslint-disable no-unused-expressions */

'use strict';
const {expect} = require('chai');
const {QueryBuilder, NONE} = require('../../../../lib/data-mapper/index');
const modelExtensionImport = require('../../../../lib/model');

module.exports = (Sequelize) => {
  const database = require('../../../database')(Sequelize);
  const modelExtension = modelExtensionImport(database.Sequelize);
  const ModelToParse = database.sequelize.define('ModelToParse', {});
  const AnotherModelToParse = database.sequelize.define('AnotherModelToParse', {field: Sequelize.STRING});
  const models = [
    ModelToParse,
    AnotherModelToParse
  ];
  models.forEach(model => modelExtension([], model));

  describe('query-builder', () => {
    it('should only allow integer or NONE as valid input for "limit"', () => {
      let err;
      try {
        new QueryBuilder({defaultLimit: NONE});
        new QueryBuilder({defaultLimit: 1});
      } catch (_err) {
        err = _err;
      }
      expect(err).to.be.undefined;
      try {
        new QueryBuilder({defaultLimit: 'test'});
      } catch (_err) {
        err = _err;
      }
      expect(err).not.to.be.undefined;
    });
    describe('create', () => {
      it('should throw an error if the maxLimit has been exceeded', () => {
        let err;
        const qb = new QueryBuilder({defaultLimit: 10, maxLimit: 5});
        try {
          qb.create({}).prepare();
        } catch (_err) {
          err = _err;
        }
        expect(err).to.exist;
        expect(err.message).to.equal('limit i=10 exceeds 5');
      });
      it('should throw an when limit=NONE but maxLimit is not NONE', () => {
        let err;
        const qb = new QueryBuilder({defaultLimit: NONE, maxLimit: 5});
        try {
          qb.create({}).prepare();
        } catch (_err) {
          err = _err;
        }
        expect(err).to.exist;
        expect(err.message).to.equal('NONE is not allowed');
      });
      it('should prevent creating a query if it has already been created', () => {
        const qb = new QueryBuilder();
        qb.create({});
        expect(qb.create.bind(qb, {})).to.throw('query already exists');
      });
      it('should not set a limit or offset if limit NONE was specified', () => {
        const qb = new QueryBuilder({defaultLimit: NONE, maxLimit: NONE});
        qb.create({}).prepare();
        expect(qb.query.limit).to.not.exist;
        expect(qb.query.offset).to.not.exist;
      });
      it('should set a limit or offset if no NONE was specified', () => {
        const qb = new QueryBuilder();
        qb.create({}).prepare();
        expect(qb.query.limit).to.exist;
        expect(qb.query.offset).to.exist;
      });
    });
    describe('_parseOrderFieldString', () => {
      it('should return the original error string if no nesting is involved', () => {
        const qb = new QueryBuilder();
        expect(qb._parseOrderFieldString('test')).to.equal('test');
      });
      it('should convert models into model instances and leave the field untouched', () => {
        const qb = new QueryBuilder({models: models.map(model => ({model}))});
        const result = qb._parseOrderFieldString('ModelToParse.AnotherModelToParse.field');
        expect(result).to.have.lengthOf(3);
        expect(result[0]).to.equal(ModelToParse);
        expect(result[1]).to.equal(AnotherModelToParse);
        expect(result[2]).to.equal('field');
      });
      it('should check if field is present in the model', () => {
        const qb = new QueryBuilder({models: models.map(model => ({model}))});
        expect(qb._parseOrderFieldString.bind(qb, 'ModelToParse.AnotherModelToParse.notARealField'))
          .to.throw('notARealField is not a field of AnotherModelToParse');
      });
    });
    describe('attachSearch', () => {
      it('should check if there is a query to attach to', () => {
        const qb = new QueryBuilder();
        expect(qb.attachSearch.bind(qb, {})).to.throw('query does not exist');
      });
      it('should prevent attaching a search to a prepared query', () => {
        const qb = new QueryBuilder();
        qb.create({});
        qb.prepare();
        expect(qb.attachSearch.bind(qb, {})).to.throw('query was already prepared');
      });
    });
    describe('prepare', () => {
      it('should check if there is a query to prepare', () => {
        const qb = new QueryBuilder();
        expect(qb.prepare.bind(qb)).to.throw('query does not exist');
      });
      it('should prevent preparing a query again', () => {
        const qb = new QueryBuilder();
        qb.create({});
        qb.prepare();
        expect(qb.prepare.bind(qb)).to.throw('query was already prepared');
      });
      it('should mark the builder as prepared', () => {
        const qb = new QueryBuilder();
        qb.create({});
        qb.prepare();
        expect(qb.prepared).to.be.true;
      });
    });
    describe('reset', () => {
      it('should reset the state of the query builder', () => {
        const qb = new QueryBuilder();
        qb.create({});
        qb.prepare();
        qb.reset();
        expect(qb.prepared).to.be.false;
        expect(qb.queryField).to.be.null;
      });
    });
    describe('query', () => {
      it('should check if a query has been set', () => {
        const qb = new QueryBuilder();
        let err;
        try {
          qb.query;
        } catch (_err) {
          err = _err;
        }
        expect(err).to.exist;
      });
    });
  });
};
