'use strict';

const {createError} = require('../../error');
const OPERATOR_TABLE = require('./operator-table');

const NONE = Symbol.for('NONE');

class QueryBuilder {
  constructor({models = [], defaultLimit = 10, maxLimit = NONE, whitelistedOperators = undefined} = {}) {
    if (defaultLimit !== NONE && isNaN(parseInt(defaultLimit))) {
      throw createError(500, `illegal input for defaultLimit: ${defaultLimit}`);
    }
    this.defaultLimit = defaultLimit;
    this.maxLimit = maxLimit;
    this.whitelistedOperators = whitelistedOperators;
    this.models = models;
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
    const page = data.p;
    const attributes = data.a ? data.a.split('|') : undefined;
    const sortField = data.f;
    const sortOrder = data.o || 'DESC';

    // TODO: allow array of sortField, sortOrder

    if (sortOrder !== 'DESC' && sortOrder !== 'ASC')
      throw createError(400, 'invalid sort order, must be DESC or ASC');

    if ((!limit || (!page && page !== 0)) && limit !== page) {
      throw createError(400, 'p or i must be both undefined or both defined.');
    }

    const limitToUse = limit || this.defaultLimit;
    const order = sortField ? [[sortField, sortOrder]] : undefined;
    this.queryField = {attributes, order};
    if (limitToUse !== NONE) {
      const limitInt = parseInt(limitToUse);
      const pageInt = parseInt(page || 0);

      if (((limitToUse && (isNaN(limitInt))) || limitInt < 0) ||
        ((page && (isNaN(pageInt))) || pageInt < 0)) {
        throw createError(400, 'p or i must be integers larger than 0!');
      }
      if (this.maxLimit && this.maxLimit !== NONE && limitInt > this.maxLimit) {
        throw createError(400, `limit i=${limitInt} exceeds ${this.maxLimit}`);
      }
      this.queryField.limit = limitInt;
      this.queryField.offset = limitInt * pageInt;
    } else {
      if (limitToUse !== this.maxLimit)
        throw createError(400, 'NONE is not allowed');
    }

    return this;
  }

  _parseOrderFieldString(orderString) {
    if (orderString.indexOf('.') === -1) return orderString;
    const splitOrderString = orderString.split('.');
    const models = splitOrderString.slice(0, splitOrderString.length - 1);
    const field = splitOrderString[splitOrderString.length - 1];
    const convertedModels = models.map(modelToConvert => {
      const convertedModel = this.models.find(model => modelToConvert === model.model.name);
      if (!convertedModel) throw createError(400, `model ${modelToConvert} not found.`);
      return convertedModel.model;
    });
    const modelWithField = convertedModels[convertedModels.length - 1];
    if (!modelWithField.getAttributes()[field])
      throw createError(400, `${field} is not a field of ${modelWithField.name}`);
    return convertedModels.concat(field);
  }

  /**
   * Attaches a search from the given input data. Cannot be called after prepared()
   *
   * @param {object} data
   */
  attachSearch(data) {
    if (this.prepared) throw createError(500, 'query was already prepared');
    if (!this.queryField) throw createError(500, 'query does not exist');

    if (!data.s) throw createError(400, 'no search parameter specified');
    const {include = [], ...where} = data.s;

    const parseInclude = (i) => {
      if (i.include) {
        i.include = i.include.map(parseInclude);
      }
      const modelToAttach = this.models.find((m) => i.model === m.model.name);
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
    if (!this.queryField) throw createError(500, 'query does not exist');

    const whiteListResult = OPERATOR_TABLE.checkAllowed(this.whitelistedOperators, this.queryField);
    if (!whiteListResult.success) {
      throw createError(403, `query included illegal operators: ${whiteListResult.operators}`);
    }
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
    if (!this.prepared) throw createError(500, 'query is not prepared');
    if (!this.queryField) throw createError(500, 'query does not exist');
    return this.queryField;
  }
}

module.exports = {
  NONE,
  QueryBuilder
};

