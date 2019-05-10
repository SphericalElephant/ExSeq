'use strict';

const {convertModel, TYPE_MAP} = require('./model-converter');

module.exports = {
  openapi: require('./openapi'),
  convertModel,
  TYPE_MAP
};
