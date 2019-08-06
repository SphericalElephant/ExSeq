'use strict';

const {createError} = require('../../error');
const OPERATOR_TABLE = require('./operator-table');

class QueryBuilder {
  constructor(limit = 10) {
    this.limit = limit;
    this.queryField = null;
    this.prepared = false;
  }

  /**
   * Creates a query from the given input data and stores it in this.queryField.
   *
   * @param {object} data may contain i,p,a,f,o
   */
  create(data) {
    if (this.prepared) throw createError(500, 'query was already prepared');
    if (this.queryField) throw createError(500, 'query already exists');

    const limit = data.i;
    const offset = data.p;
    const attributes = data.a ? data.a.split('|') : undefined;
    const sortField = data.f;
    const sortOrder = data.o || 'DESC';

    if (sortOrder !== 'DESC' && sortOrder !== 'ASC')
      throw createError(400, 'invalid sort order, must be DESC or ASC');

    if ((!limit || (!offset && offset !== 0)) && limit !== offset) {
      return createError(400, 'p or i must be both undefined or both defined.');
    }

    const limitInt = parseInt(limit || this.limit);
    const offsetInt = parseInt(offset || 0);

    if (((limit && (isNaN(limitInt))) || limitInt < 0) ||
      ((offset && (isNaN(offsetInt))) || offsetInt < 0)) {
      throw createError(400, 'p or i must be integers larger than 0!');
    }
    const order = sortField ? [[sortField, sortOrder]] : undefined;
    this.queryField = {limit: limitInt, offset: limitInt * offsetInt, attributes, order};
    return this;
  }

  /**
   * Attaches a search from the given input data. Cannot be called after prepared()
   *
   * @param {object} data
   */
  attachSearch(data, models = []) {
    if (this.prepared) throw createError(500, 'query was already prepared');
    if (!this.queryField) throw createError(500, 'query does not exist!');

    if (!data.s) throw createError(400, 'no search parameter specified');
    const {include = [], ...where} = data.s;

    const parseInclude = (i) => {
      if (i.include) {
        i.include = i.include.map(parseInclude);
      }
      const modelToAttach = models.find((m) => i.model === m.model.name);
      if (modelToAttach) {
        return {
          ...i,
          model: modelToAttach.model
        };
      }
      return i;
    };

    const includeWithAttachedModel = include.map(parseInclude);

    // reject if one of the models could not be resolved
    const modelToReject = includeWithAttachedModel.find((i) => typeof i.model === 'string');
    if (modelToReject) {
      throw createError(404, `unable to resolve model ${modelToReject.model}`);
    }

    const newQuery = Object.assign({}, this.queryField);
    this.queryField = Object.assign(newQuery, {where, include: includeWithAttachedModel});
    return this;
  }

  /**
   * Prepares the query by replacing the string operators with the correct operators from
   * the OPERATOR_TABLE. Can only be called once for any given query!
   */
  prepare() {
    if (this.prepared) throw createError(500, 'query was already prepared');
    if (!this.queryField) throw createError(500, 'query does not exist!');

    OPERATOR_TABLE.replace(this.queryField);

    this.prepared = true;
    return this;
  }

  /**
   * Resets the state of the builder
   */
  reset() {
    this.prepared = false;
    this.queryField = null;
    return this;
  }

  /**
   * Gets the completed query.
   */
  get query() {
    if (!this.queryField) throw createError(500, 'query does not exist!');
    return this.queryField;
  }
}

module.exports = QueryBuilder;

