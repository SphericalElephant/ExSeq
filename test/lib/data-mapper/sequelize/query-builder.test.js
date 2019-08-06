/* eslint-disable no-unused-expressions */

'use strict';
const {expect} = require('chai');
const {QueryBuilder} = require('../../../../lib/data-mapper/index');

describe('query-builder', () => {
  it('should only allow integer or NONE as valid input for "limit"', () => {
    let err;
    try {
      new QueryBuilder('NONE');
      new QueryBuilder(1);
    } catch (_err) {
      err = _err;
    }
    expect(err).to.be.undefined;
    try {
      new QueryBuilder('test');
    } catch (_err) {
      err = _err;
    }
    expect(err).not.to.be.undefined;
  });
  describe('create', () => {
    it('should prevent creating a query if it has already been created', () => {
      const qb = new QueryBuilder();
      qb.create({});
      expect(qb.create.bind(qb, {})).to.throw('query already exists');
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
});
