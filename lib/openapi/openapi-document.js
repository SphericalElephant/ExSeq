'use strict';

const validateSchema = require('./schema-validator');
const allowedOperations = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];

class OpenApiDocument {
  constructor(opts) {
    this.openapi = '3.0.2';
    this.info = opts ? opts.info : {
      title: 'Placeholder API',
      version: '1.0.0'
    };
    this.servers = opts ? opts.servers : [];
    this.paths = opts ? opts.paths : {};
    this.components = opts ? opts.components : {
      schemas: {},
      responses: {},
      parameters: {},
      examples: {},
      requestBodies: {},
      headers: {},
      securitySchemes: {},
      links: {},
      callbacks: {}
    };
    this.security = opts ? opts.security : [];
    this.tags = opts ? opts.tags : [];
    if (opts && opts.externalDocs) {
      this.externalDocs = opts.externalDocs;
    }
  }

  setPath(name, pathItem) {
    if (!/^\//.test(name)) {
      throw new Error(`Invalid path name ${name} - MUST start with "/"`);
    }
    this.paths[name] = pathItem;
  }

  pathExists(name) {
    return this.paths[name] !== undefined;
  }

  pathHasOpeations(name) {
    return this.pathExists(name) && allowedOperations.find(op => this.operationExists(name, op));
  }

  setPathIfNotExists(name, pathItem) {
    if (!this.pathExists(name)) {
      this.setPath(name, pathItem);
    }
  }

  addPaths(paths) {
    for (const name in paths) {
      this.setPathIfNotExists(name, paths[name]);
    }
  }

  setOperation(pathName, operationName, operationItem) {
    if (!this.pathExists(pathName)) {
      throw new Error(`Path ${pathName} does not exist`);
    }
    if (!allowedOperations.includes(operationName)) {
      throw new Error(`Illegal path operation: ${operationName}`);
    }
    this.paths[pathName][operationName] = operationItem;
  }

  operationExists(pathName, operationName) {
    return this.paths[pathName][operationName] !== undefined;
  }

  setOperationIfNotExists(pathName, operationName, operationItem) {
    if (!this.operationExists(pathName, operationName)) {
      this.setOperation(pathName, operationName, operationItem);
    }
  }

  setSchema(name, schema) {
    this.components.schemas[name] = schema;
  }

  addSchemas(schemas) {
    for (const name in schemas) {
      this.setSchema(name, schemas[name]);
    }
  }

  schemaExists(name) {
    return this.components.schemas[name] !== undefined;
  }

  cleanPaths() {
    for (const pathName in this.paths) {
      if (!this.pathHasOpeations(pathName)) {
        delete this.paths[pathName];
      }
    }
  }

  valid(opts) {
    return validateSchema(this, opts);
  }
}

module.exports = OpenApiDocument;
