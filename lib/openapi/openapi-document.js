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
    this.paths = opts ? opts.path : {};
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

  setParameterIfNotExists(name, parameter) {
    if (!this.components.parameters) {
      this.components.parameters = {};
    }
    if (!this.components.parameters[name]) {
      this.components.parameters[name] = parameter;
    }
  }

  addParameters(parameters) {
    for (const parameterName in parameters) {
      this.setParameterIfNotExists(parameterName, parameters[parameterName]);
    }
  }

  setRequestBodyIfNotExists(name, requestBody) {
    if (!this.components.requestBodies) {
      this.components.requestBodies = {};
    }
    if (!this.components.requestBodies[name]) {
      this.components.requestBodies[name] = requestBody;
    }
  }

  addRequestBodies(requestBodies) {
    for (const requestBodyName in requestBodies) {
      this.setRequestBodyIfNotExists(requestBodyName, requestBodies[requestBodyName]);
    }
  }

  setResponseIfNotExists(name, response) {
    if (!this.components.responses) {
      this.components.responses = {};
    }
    if (!this.components.responses[name]) {
      this.components.responses[name] = response;
    }
  }

  addResponses(responses) {
    for (const responseName in responses) {
      this.setResponseIfNotExists(responseName, responses[responseName]);
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

  setHeaderIfNotExists(name, header) {
    if (!this.components.headers) {
      this.components.headers = {};
    }
    if (!this.components.headers[name]) {
      this.components.headers[name] = header;
    }
  }

  addHeaders(headers) {
    for (const name in headers) {
      this.setHeaderIfNotExists(name, headers[name]);
    }
  }

  addComponents(components) {
    for (const componentType in components) {
      switch (componentType) {
        case 'headers':
          this.addHeaders(components[componentType]);
          break;
        case 'parameters':
          this.addParameters(components[componentType]);
          break;
        case 'requestBodies':
          this.addRequestBodies(components[componentType]);
          break;
        case 'responses':
          this.addResponses(components[componentType]);
          break;
        case 'schemas':
          this.addSchemas(components[componentType]);
          break;
        default: console.warn('Component type not supported by OpenApiDocument.addComponents:', componentType);
      }
    }
  }

  addOperationAndComponents(pathName, operationName, data) {
    if (!data.operation) {
      throw new Error('data.operation must not be null or undefined.');
    }
    this.setOperationIfNotExists(pathName, operationName, data.operation);
    this.addComponents(data.components);
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
