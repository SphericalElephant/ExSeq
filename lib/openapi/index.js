'use strict';

const implementation = require('./sequelize');
const OpenApiDocument = require('./openapi-document');

module.exports = {
  OpenApi: implementation,
  OpenApiDocument
};
