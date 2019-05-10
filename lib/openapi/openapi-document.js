'use strict';

class OpenApiDocument {
  constructor(opts) {
    this.openapi = '3.0.2';
    this.info = {
      title: 'Placeholder API',
      version: '1.0.0'
    };
    this.paths = {};
    this.components = {
      headers: {},
      schemas: {}
    };
  }
}

module.exports = OpenApiDocument;
