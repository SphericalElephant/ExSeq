'use strict';

const OpenApiBuilder = require('../openapi-builder');

const {
  ATTRIBUTE_FILTER_PARAMETER,
  QUERY_PARAMETERS,
  SEARCH_REQUEST_BODY,
  X_TOTAL_COUNT_SPECIFICATION,
  RESPONSE_REFS
} = require('../openapi-exseq');

const {TYPE_MAP, convertModel} = require('./model-converter');

class SequelizeOpenApiBuilder extends OpenApiBuilder {
  constructor(model, basePath, opts) {
    super(opts);
    this.model = model;
    this.basePath = basePath;
    this.tags = opts.tags || [];
    this.operationIdPrefix = opts.operationIdPrefix || 'SequelizeOpenApiBuilder';
    this.pathOpts = opts.pathOpts || {};
    this.idParameter = SequelizeOpenApiBuilder.createIdParameterSpecification(model);
    this.modelRef = {$ref: `#/components/schemas/${model.name}`};
  }

  static createIdParameterSpecification(model) {
    if (Object.keys(model.primaryKeys).length != 1) {
      throw new Error(`Model must have exactly one primary key field. Model: ${model.name}`);
    }
    return {
      name: 'id',
      in: 'path',
      description: 'The instance\'s id.',
      required: true,
      schema: TYPE_MAP[model.primaryKeys[Object.keys(model.primaryKeys)[0]].type.constructor.name]
    };
  }
  static convert(model) {
    return convertModel(model);
  }

  static createModelSchemasRecursive(model, existingSchemas) {
    let schemas = {...existingSchemas};
    if (!schemas[model.name]) {
      schemas[model.name] = SequelizeOpenApiBuilder.convert(model);
    }
    for (const associationName in model.associations) {
      const targetModel = model.associations[associationName].target;
      if (!schemas[targetModel.name]) {
        schemas = SequelizeOpenApiBuilder.createModelSchemasRecursive(targetModel, schemas);
      }
    }
    return schemas;
  }

  getPathOptions(path) {
    return this.pathOpts[path] || {};
  }

  createPathItemStub(path) {
    const pathOpts = this.getPathOptions(path);
    // $ref is not supported
    return {
      summary: pathOpts.summary || this.model.name,
      description: pathOpts.description || this.model.name,
      servers: pathOpts.servers || [],
      parameters: pathOpts.parameters || []
    };
  }

  createBasePathSpecification(path, operation) {
    const pathOpts = this.getPathOptions(path)[operation] || {};
    const baseSpecification = {
      tags: [...this.tags, this.model.name],
      callbacks: pathOpts.callbacks || {},
      deprecated: pathOpts.deprecated || false
    };
    if (pathOpts.security) {
      baseSpecification.security = pathOpts.security;
    }
    if (pathOpts.servers) {
      baseSpecification.servers = pathOpts.servers;
    }
    if (pathOpts.externalDocs) {
      baseSpecification.externalDocs = pathOpts.externalDocs;
    }
    return baseSpecification;
  }

  createModelPathSpecification(operation) {
    const path = '/';
    const pathOpts = this.getPathOptions(path)[operation] || {};
    const baseSpecification = this.createBasePathSpecification(path, operation);
    switch (operation) {
      case 'get':
        return {
          ...baseSpecification,
          operationId: pathOpts.operationId || `get-${this.model.name}`,
          summary: `Obtain all instances of ${this.model.name}`,
          description: `Obtain all instances of ${this.model.name}`,
          parameters: QUERY_PARAMETERS,
          responses: {
            200: {
              description: `An array containing all instances of ${this.model.name}`,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      payload: {
                        type: 'array',
                        items: this.modelRef
                      }
                    }
                  }
                }
              }
            },
            400: RESPONSE_REFS.exseqInvalidInput,
            401: RESPONSE_REFS.exseqUnauthorized,
            500: RESPONSE_REFS.exseqUnexpectedError
          }
        };
      case 'post':
        return {
          ...baseSpecification,
          operationId: pathOpts.operationId || `create-${this.model.name}`,
          summary: `Create a new ${this.model.name} instance`,
          description: `Create a new ${this.model.name} instance`,
          requestBody: {
            content: {
              'application/json': {schema: this.modelRef}
            },
            required: true
          },
          responses: {
            201: {
              description: `The created instance of ${this.model.name}`,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      payload: this.modelRef
                    }
                  }
                }
              }
            },
            400: RESPONSE_REFS.exseqInvalidInput,
            401: RESPONSE_REFS.exseqUnauthorized,
            500: RESPONSE_REFS.exseqUnexpectedError
          }
        };
      default: throw new Error(`Operation ${operation} not supported for path '/'`);
    }
  }

  createCountModelPathSpecification() {
    const path = '/count';
    const operation = 'get';
    const pathOpts = this.getPathOptions(path)[operation] || {};
    const baseSpecification = this.createBasePathSpecification(path, operation);
    return {
      ...baseSpecification,
      operationId: pathOpts.operationId || `count-${this.model.name}`,
      summary: `Obtains the count of all ${this.model.name} entities`,
      description: `Obtains the count of all ${this.model.name} entities`,
      responses: {
        200: {
          description: `An array containing all instances of ${this.model.name}`,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  payload: {
                    type: 'integer'
                  },
                  message: {
                    type: 'string'
                  }
                }
              }
            }
          }
        },
        401: RESPONSE_REFS.exseqUnauthorized,
        500: RESPONSE_REFS.exseqUnexpectedError
      }
    };
  }

  createSearchModelPathSpecification() {
    const path = '/search';
    const operation = 'post';
    const pathOpts = this.getPathOptions(path)[operation] || {};
    const baseSpecification = this.createBasePathSpecification(path, operation);
    return {
      ...baseSpecification,
      operationId: pathOpts.operationId || `search-${this.model.name}`,
      summary: `Search the ${this.model.name} table`,
      description: `Search the ${this.model.name} table`,
      requestBody: SEARCH_REQUEST_BODY,
      responses: {
        200: {
          description: `An array containing found instances of ${this.model.name}`,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  payload: {
                    type: 'array',
                    items: this.modelRef
                  }
                }
              }
            }
          },
          headers: {
            'X-Total-Count': X_TOTAL_COUNT_SPECIFICATION
          }
        },
        204: {
          description: 'No instances found.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  payload: {
                    type: 'array',
                    items: this.modelRef
                  }
                }
              }
            }
          },
          headers: {
            'X-Total-Count': X_TOTAL_COUNT_SPECIFICATION
          }
        },
        400: RESPONSE_REFS.exseqInvalidInput,
        401: RESPONSE_REFS.exseqUnauthorized,
        500: RESPONSE_REFS.exseqUnexpectedError
      }
    };
  }

  createInstancePathSpecification(operation) {
    const path = '/:id';
    const pathOpts = this.getPathOptions(path)[operation] || {};
    const baseSpecification = this.createBasePathSpecification(path, operation);
    switch (operation) {
      case 'get':
        return {
          ...baseSpecification,
          operationId: pathOpts.operationId || `get-${this.model.name}-by-id`,
          summary: `Obtain the specified ${this.model.name} instance`,
          description: `Obtain the specified ${this.model.name} instance`,
          parameters: [
            this.idParameter,
            ATTRIBUTE_FILTER_PARAMETER
          ],
          responses: {
            200: {
              description: `The specified ${this.model.name} instance`,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      payload: this.modelRef
                    }
                  }
                }
              }
            },
            401: RESPONSE_REFS.exseqUnauthorized,
            404: RESPONSE_REFS.exseqNotFound,
            500: RESPONSE_REFS.exseqUnexpectedError
          }
        };
      case 'put':
        return {
          ...baseSpecification,
          operationId: pathOpts.operationId || `update-${this.model.name}-by-id`,
          summary: `Replace all values of the specified ${this.model.name} instance`,
          description: `Replace all values of the specified ${this.model.name} instance`,
          parameters: [this.idParameter],
          requestBody: {
            content: {
              'application/json': {schema: this.modelRef}
            },
            required: true
          },
          responses: {
            204: RESPONSE_REFS.exseqEmpty,
            401: RESPONSE_REFS.exseqUnauthorized,
            404: RESPONSE_REFS.exseqNotFound,
            500: RESPONSE_REFS.exseqUnexpectedError
          }
        };
      case 'patch':
        return {
          ...baseSpecification,
          operationId: pathOpts.operationId || `update-partial-${this.model.name}-by-id`,
          summary: `Replace selected values of the specified ${this.model.name} instance`,
          description: `Replace selected values of the specified ${this.model.name} instance`,
          parameters: [this.idParameter],
          requestBody: {
            content: {
              'application/json': {schema: this.modelRef} // TODO: nothing should be required!
            },
            required: true
          },
          responses: {
            204: RESPONSE_REFS.exseqEmpty,
            401: RESPONSE_REFS.exseqUnauthorized,
            404: RESPONSE_REFS.exseqNotFound,
            500: RESPONSE_REFS.exseqUnexpectedError
          }
        };
      case 'delete':
        return {
          ...baseSpecification,
          operationId: pathOpts.operationId || `delete-${this.model.name}-by-id`,
          summary: `Delete the specified ${this.model.name} instance`,
          description: `Delete the specified ${this.model.name} instance`,
          parameters: [this.idParameter],
          responses: {
            204: RESPONSE_REFS.exseqEmpty,
            401: RESPONSE_REFS.exseqUnauthorized,
            404: RESPONSE_REFS.exseqNotFound,
            500: RESPONSE_REFS.exseqUnexpectedError
          }
        };
      default: throw new Error(`Operation ${operation} not supported for path ${path}`);
    }
  }

  createHasOneOrBelongsToPathSpecification(operation, target, targetPath) {
    if (!target) {
      throw new Error('target must not be null');
    }
    const path = `/:id/${targetPath || target.name}`;
    const targetRef = {$ref: `#/components/schemas/${target.name}`};
    const pathOpts = this.getPathOptions(path)[operation] || {};
    const baseSpecification = this.createBasePathSpecification(path, operation);
    switch (operation) {
      case 'get':
        return {
          ...baseSpecification,
          operationId: pathOpts.operationId || `get-${target.name}-by-${this.model.name}-id`,
          summary: `Get all ${target.name} instances of ${this.model.name}`,
          description: `Get all ${target.name} instances of ${this.model.name}`,
          parameters: [this.idParameter],
          responses: {
            200: {
              description: `An array containing all ${target.name} instances of ${this.model.name}`,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      payload: {
                        type: 'array',
                        items: targetRef
                      }
                    }
                  }
                }
              }
            },
            400: RESPONSE_REFS.exseqInvalidInput,
            401: RESPONSE_REFS.exseqUnauthorized,
            500: RESPONSE_REFS.exseqUnexpectedError
          }
        };
      case 'post':
        return {
          ...baseSpecification,
          operationId: pathOpts.operationId || `create-${target.name}-by-${this.model.name}-id`,
          summary: `Create a new ${target.name} instance and associate it with ${this.model.name}`,
          description: `Create a new ${target.name} instance and associate it with ${this.model.name}`,
          parameters: [this.idParameter],
          requestBody: {
            content: {
              'application/json': {schema: targetRef}
            },
            required: true
          },
          responses: {
            201: {
              description: `The created instance of ${target.name}`,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      payload: targetRef
                    }
                  }
                }
              }
            },
            400: RESPONSE_REFS.exseqInvalidInput,
            401: RESPONSE_REFS.exseqUnauthorized,
            500: RESPONSE_REFS.exseqUnexpectedError
          }
        };
      case 'put':
        return {
          ...baseSpecification,
          operationId: pathOpts.operationId || `update-${target.name}-by-${this.model.name}-id`,
          summary: `Replace all values of the ${target.name} instance`,
          description: `Replace all values of the ${target.name} instance`,
          parameters: [this.idParameter],
          requestBody: {
            content: {
              'application/json': {schema: targetRef}
            },
            required: true
          },
          responses: {
            204: RESPONSE_REFS.exseqEmpty,
            401: RESPONSE_REFS.exseqUnauthorized,
            404: RESPONSE_REFS.exseqNotFound,
            500: RESPONSE_REFS.exseqUnexpectedError
          }
        };
      case 'patch':
        return {
          ...baseSpecification,
          operationId: pathOpts.operationId || `update-partial-${target.name}-by-${this.model.name}-id`,
          summary: `Replace selected values of the ${target.name} instance`,
          description: `Replace selected values of the ${target.name} instance`,
          parameters: [this.idParameter],
          requestBody: {
            content: {
              'application/json': {schema: targetRef} // TODO: nothing should be required!
            },
            required: true
          },
          responses: {
            204: RESPONSE_REFS.exseqEmpty,
            401: RESPONSE_REFS.exseqUnauthorized,
            404: RESPONSE_REFS.exseqNotFound,
            500: RESPONSE_REFS.exseqUnexpectedError
          }
        };
      case 'delete':
        return {
          ...baseSpecification,
          operationId: pathOpts.operationId || `delete-${target.name}-by-${this.model.name}-id`,
          summary: 'Remove the association',
          description: 'Remove the association',
          parameters: [this.idParameter],
          responses: {
            204: RESPONSE_REFS.exseqEmpty,
            401: RESPONSE_REFS.exseqUnauthorized,
            404: RESPONSE_REFS.exseqNotFound,
            500: RESPONSE_REFS.exseqUnexpectedError
          }
        };
      default:
        throw new Error(`Operation ${operation} not supported for path ${path}`);
    }
  }

  createHasManyOrBelongsToManyPathSpecfication(operation, target, targetPath) {
    if (!target) {
      throw new Error('target must not be null');
    }
    const path = `/:id/${targetPath || target.name}`;
    const targetRef = {$ref: `#/components/schemas/${target.name}`};
    const pathOpts = this.getPathOptions(path)[operation] || {};
    const baseSpecification = this.createBasePathSpecification(path, operation);
    switch (operation) {
      case 'get':
        return {
          ...baseSpecification,
          operationId: pathOpts.operationId || `get-${target.name}-by-${this.model.name}-id`,
          summary: `Obtains an array of all associated ${target.name} instances`,
          description: `Obtains an array of all associated ${target.name} instances`,
          parameters: [
            this.idParameter,
            ATTRIBUTE_FILTER_PARAMETER
          ],
          responses: {
            200: {
              description: `An array containing all associated ${target.name} instances`,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      payload: {
                        type: 'array',
                        items: targetRef
                      }
                    }
                  }
                }
              }
            },
            400: RESPONSE_REFS.exseqInvalidInput,
            401: RESPONSE_REFS.exseqUnauthorized,
            500: RESPONSE_REFS.exseqUnexpectedError
          }
        };
      case 'post':
        return {
          ...baseSpecification,
          operationId: pathOpts.operationId || `create-${target.name}-by-${this.model.name}-id`,
          summary: `Creates and associates a new ${target.name} instance`,
          description: `Creates and associates a new ${target.name} instance`,
          parameters: [this.idParameter],
          requestBody: {
            content: {
              'application/json': {schema: targetRef}
            },
            required: true
          },
          responses: {
            201: {
              description: `The created instance of ${target.name}`,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      payload: targetRef
                    }
                  }
                }
              }
            },
            400: RESPONSE_REFS.exseqInvalidInput,
            401: RESPONSE_REFS.exseqUnauthorized,
            500: RESPONSE_REFS.exseqUnexpectedError
          }
        };
      case 'delete':
        return {
          ...baseSpecification,
          operationId: pathOpts.operationId || `delete-${target.name}-by-${this.model.name}-id`,
          summary: 'Removes all associations',
          description: 'Removes all associations',
          parameters: [this.idParameter],
          responses: {
            204: RESPONSE_REFS.exseqEmpty,
            401: RESPONSE_REFS.exseqUnauthorized,
            404: RESPONSE_REFS.exseqNotFound,
            500: RESPONSE_REFS.exseqUnexpectedError
          }
        };
      default:
        throw new Error(`Operation ${operation} not supported for path ${path}`);
    }
  }

  createCountHasManyOrBelongsToManyPathSpecfication(target, targetPath) {
    if (!target) {
      throw new Error('target must not be null');
    }
    const path = `/:id/${targetPath || target.name}/count`;
    const operation = 'get';
    const pathOpts = this.getPathOptions(path)[operation] || {};
    const baseSpecification = this.createBasePathSpecification(path, operation);
    return {
      ...baseSpecification,
      operationId: pathOpts.operationId || `count-${target.name}-by-${this.model.name}-id`,
      summary: `Obtains the count of all ${target.name} entities`,
      description: `Obtains the count of all ${target.name} entities`,
      parameters: [this.idParameter],
      responses: {
        200: {
          description: `An array containing all instances of ${target.name}`,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  payload: {
                    type: 'integer'
                  },
                  message: {
                    type: 'string'
                  }
                }
              }
            }
          }
        },
        401: RESPONSE_REFS.exseqUnauthorized,
        500: RESPONSE_REFS.exseqUnexpectedError
      }
    };
  }

  createSearchHasManyOrBelongsToManyPathSpecfication(target, targetPath) {
    if (!target) {
      throw new Error('target must not be null');
    }
    const targetRef = {$ref: `#/components/schemas/${target.name}`};
    const path = `/:id/${targetPath || target.name}/search`;
    const operation = 'post';
    const pathOpts = this.getPathOptions(path)[operation] || {};
    const baseSpecification = this.createBasePathSpecification(path, operation);
    return {
      ...baseSpecification,
      operationId: pathOpts.operationId || `search-${target.name}-by-${this.model.name}-id`,
      summary: `Search items in the ${target.name} table that are related to ${this.model.name}`,
      description: `Search items in the ${target.name} table that are related to ${this.model.name}`,
      parameters: [this.idParameter],
      requestBody: SEARCH_REQUEST_BODY,
      responses: {
        200: {
          description: `An array containing found instances of ${target.name}`,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  payload: {
                    type: 'array',
                    items: targetRef
                  }
                }
              }
            }
          },
          headers: {
            'X-Total-Count': X_TOTAL_COUNT_SPECIFICATION
          }
        },
        204: {
          description: 'No instances found.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  payload: {
                    type: 'array',
                    items: targetRef
                  }
                }
              }
            }
          },
          headers: {
            'X-Total-Count': X_TOTAL_COUNT_SPECIFICATION
          }
        },
        400: RESPONSE_REFS.exseqInvalidInput,
        401: RESPONSE_REFS.exseqUnauthorized,
        500: RESPONSE_REFS.exseqUnexpectedError
      }
    };
  }

  createHasManyOrBelongsToManyInstancePathSpecfication(operation, target, targetPath) {
    if (!target) {
      throw new Error('target must not be null');
    }
    const path = `/:id/${targetPath || target.name}/:targetId`;
    const targetRef = {$ref: `#/components/schemas/${target.name}`};
    const pathOpts = this.getPathOptions(path)[operation] || {};
    const baseSpecification = this.createBasePathSpecification(path, operation);
    const targetIdParameter = {
      ...SequelizeOpenApiBuilder.createIdParameterSpecification(target),
      name: 'targetId',
      description: 'The target instance\'s id'
    };
    switch (operation) {
      case 'get':
        return {
          ...baseSpecification,
          operationId: pathOpts.operationId || `get-${target.name}-by-${this.model.name}-id-and-target-id`,
          summary: `Obtains a single ${target.name} instance`,
          description: `Obtains a single ${target.name} instance`,
          parameters: [
            this.idParameter,
            targetIdParameter,
            ATTRIBUTE_FILTER_PARAMETER
          ],
          responses: {
            200: {
              description: `The specified ${target.name} instance`,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      payload: targetRef
                    }
                  }
                }
              }
            },
            400: RESPONSE_REFS.exseqInvalidInput,
            401: RESPONSE_REFS.exseqUnauthorized,
            500: RESPONSE_REFS.exseqUnexpectedError
          }
        };
      case 'put':
        return {
          ...baseSpecification,
          operationId: pathOpts.operationId || `update-${target.name}-by-${this.model.name}-id-and-target-id`,
          summary: `Replace all values of the ${target.name} instance`,
          description: `Replace all values of the specified ${target.name} instance`,
          parameters: [
            this.idParameter,
            targetIdParameter
          ],
          requestBody: {
            content: {
              'application/json': {schema: targetRef}
            },
            required: true
          },
          responses: {
            204: RESPONSE_REFS.exseqEmpty,
            401: RESPONSE_REFS.exseqUnauthorized,
            404: RESPONSE_REFS.exseqNotFound,
            500: RESPONSE_REFS.exseqUnexpectedError
          }
        };
      case 'patch':
        return {
          ...baseSpecification,
          operationId: pathOpts.operationId || `update-partial-${target.name}-by-${this.model.name}-id-and-target-id`,
          summary: `Replace selected values of the ${target.name} instance`,
          description: `Replace selected values of the ${target.name} instance`,
          parameters: [
            this.idParameter,
            targetIdParameter
          ],
          requestBody: {
            content: {
              'application/json': {schema: targetRef} // TODO: nothing should be required!
            },
            required: true
          },
          responses: {
            204: RESPONSE_REFS.exseqEmpty,
            401: RESPONSE_REFS.exseqUnauthorized,
            404: RESPONSE_REFS.exseqNotFound,
            500: RESPONSE_REFS.exseqUnexpectedError
          }
        };
      case 'delete':
        return {
          ...baseSpecification,
          operationId: pathOpts.operationId || `delete-${target.name}-by-${this.model.name}-id-and-target-id`,
          summary: `Delete the specified ${target.name} instance`,
          description: `Delete the specified ${target.name} instance`,
          parameters: [
            this.idParameter,
            targetIdParameter
          ],
          responses: {
            204: RESPONSE_REFS.exseqEmpty,
            401: RESPONSE_REFS.exseqUnauthorized,
            404: RESPONSE_REFS.exseqNotFound,
            500: RESPONSE_REFS.exseqUnexpectedError
          }
        };
      default: throw new Error(`Operation ${operation} not supported for path ${path}`);
    }
  }

  createLinkBelongsToManyPathSpecification(target, targetPath) {
    if (!target) {
      throw new Error('target must not be null');
    }
    const path = `/:id/${targetPath || target.name}/:targetId`;
    const operation = 'post';
    const pathOpts = this.getPathOptions(path)[operation] || {};
    const baseSpecification = this.createBasePathSpecification(path, operation);
    const targetIdParameter = {
      ...SequelizeOpenApiBuilder.createIdParameterSpecification(target),
      name: 'targetId',
      description: 'The target instance\'s id'
    };
    return {
      ...baseSpecification,
      operationId: pathOpts.operationId || `link-${target.name}-by-${this.model.name}-id-and-target-id`,
      summary: `Link existing ${this.model.name} and ${target.name} instances`,
      description: `Link existing ${this.model.name} and ${target.name} instances`,
      parameters: [
        this.idParameter,
        targetIdParameter
      ],
      responses: {
        204: RESPONSE_REFS.exseqEmpty,
        401: RESPONSE_REFS.exseqUnauthorized,
        404: RESPONSE_REFS.exseqNotFound,
        500: RESPONSE_REFS.exseqUnexpectedError
      }
    };
  }

  createUnlinkBelongsToManyPathSpecification(target, targetPath) {
    if (!target) {
      throw new Error('target must not be null');
    }
    const path = `/:id/${targetPath || target.name}/:targetId`;
    const operation = 'delete';
    const pathOpts = this.getPathOptions(path)[operation] || {};
    const baseSpecification = this.createBasePathSpecification(path, operation);
    const targetIdParameter = {
      ...SequelizeOpenApiBuilder.createIdParameterSpecification(target),
      name: 'targetId',
      description: 'The target instance\'s id'
    };
    return {
      ...baseSpecification,
      operationId: pathOpts.operationId || `unlink-${target.name}-by-${this.model.name}-id-and-target-id`,
      summary: `Unlink existing ${this.model.name} and ${target.name} instances`,
      description: `Unlink existing ${this.model.name} and ${target.name} instances`,
      parameters: [
        this.idParameter,
        targetIdParameter
      ],
      responses: {
        204: RESPONSE_REFS.exseqEmpty,
        401: RESPONSE_REFS.exseqUnauthorized,
        404: RESPONSE_REFS.exseqNotFound,
        500: RESPONSE_REFS.exseqUnexpectedError
      }
    };
  }
}

module.exports = SequelizeOpenApiBuilder;
