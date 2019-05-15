'use strict';

const OpenApiBuilder = require('../openapi-builder');

const {
  ATTRIBUTE_FILTER_PARAMETER,
  QUERY_PARAMETERS,
  SEARCH_REQUEST_BODY,
  X_TOTAL_COUNT_SPECIFICATION,
  EMPTY_RESPONSE
} = require('../openapi-exseq');

const {TYPE_MAP, convertModel} = require('./model-converter');

class SequelizeOpenApiBuilder extends OpenApiBuilder {
  constructor(model, basePath, opts) {
    super(opts);
    this.model = model;
    this.basePath = basePath;
    this.opts = opts;
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
    for (const associationName of model.getAssociatedModelNames()) {
      const targetModel = model.getAssociationByName(associationName).target;
      if (!schemas[targetModel.name]) {
        schemas = SequelizeOpenApiBuilder.createModelSchemasRecursive(targetModel, schemas);
      }
    }
    return schemas;
  }

  getPathOptions(path) {
    return this.opts[path] || {};
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
      tags: ['exseq', this.model.name],
      operationId: `exseq-${this.basePath}${path}-${operation}`,
      callbacks: pathOpts.callbacks || {},
      deprecated: pathOpts.deprecated || false,
      security: pathOpts.security || [],
      servers: pathOpts.servers || []
    };
    if (pathOpts.externalDocs) {
      baseSpecification.externalDocs = pathOpts.externalDocs;
    }
    return baseSpecification;
  }

  createModelPathSpecification(operation) {
    const baseSpecification = this.createBasePathSpecification('/', operation);
    switch (operation) {
      case 'get':
        return {
          ...baseSpecification,
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
            400: {description: 'validation error'},
            401: {description: 'authorization error'},
            500: {description: 'internal server error'}
          }
        };
      case 'post':
        return {
          ...baseSpecification,
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
            400: {description: 'validation error'},
            401: {description: 'authorization error'},
            500: {description: 'internal server error'}
          }
        };
      default: throw new Error(`Operation ${operation} not supported for path '/'`);
    }
  }

  createCountModelPathSpecification() {
    const baseSpecification = this.createBasePathSpecification('/count', 'get');
    return {
      ...baseSpecification,
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
        401: {description: 'authorization error'},
        500: {description: 'internal server error'}
      }
    };
  }

  createSearchModelPathSpecification() {
    const baseSpecification = this.createBasePathSpecification('/search', 'post');
    return {
      ...baseSpecification,
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
        400: {description: 'validation error'},
        401: {description: 'authorization error'},
        500: {description: 'internal server error'}
      }
    };
  }

  createInstancePathSpecification(operation) {
    const path = '/:id';
    const baseSpecification = this.createBasePathSpecification(path, operation);
    switch (operation) {
      case 'get':
        return {
          ...baseSpecification,
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
            401: {description: 'authorization error'},
            404: {description: 'entity not found'},
            500: {description: 'internal server error'}
          }
        };
      case 'put':
        return {
          ...baseSpecification,
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
            204: EMPTY_RESPONSE,
            401: {description: 'authorization error'},
            404: {description: 'entity not found'},
            500: {description: 'internal server error'}
          }
        };
      case 'patch':
        return {
          ...baseSpecification,
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
            204: EMPTY_RESPONSE,
            401: {description: 'authorization error'},
            404: {description: 'entity not found'},
            500: {description: 'internal server error'}
          }
        };
      case 'delete':
        return {
          ...baseSpecification,
          summary: `Delete the specified ${this.model.name} instance`,
          description: `Delete the specified ${this.model.name} instance`,
          parameters: [this.idParameter],
          responses: {
            204: EMPTY_RESPONSE,
            401: {description: 'authorization error'},
            404: {description: 'entity not found'},
            500: {description: 'internal server error'}
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
    const baseSpecification = this.createBasePathSpecification(path, operation);
    switch (operation) {
      case 'get':
        return {
          ...baseSpecification,
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
            400: {description: 'validation error'},
            401: {description: 'authorization error'},
            500: {description: 'internal server error'}
          }
        };
      case 'post':
        return {
          ...baseSpecification,
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
            400: {description: 'validation error'},
            401: {description: 'authorization error'},
            500: {description: 'internal server error'}
          }
        };
      case 'put':
        return {
          ...baseSpecification,
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
            204: EMPTY_RESPONSE,
            401: {description: 'authorization error'},
            404: {description: 'entity not found'},
            500: {description: 'internal server error'}
          }
        };
      case 'patch':
        return {
          ...baseSpecification,
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
            204: EMPTY_RESPONSE,
            401: {description: 'authorization error'},
            404: {description: 'entity not found'},
            500: {description: 'internal server error'}
          }
        };
      case 'delete':
        return {
          ...baseSpecification,
          summary: 'Remove the association',
          description: 'Remove the association',
          parameters: [this.idParameter],
          responses: {
            204: EMPTY_RESPONSE,
            401: {description: 'authorization error'},
            404: {description: 'entity not found'},
            500: {description: 'internal server error'}
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
    const baseSpecification = this.createBasePathSpecification(path, operation);
    switch (operation) {
      case 'get':
        return {
          ...baseSpecification,
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
            400: {description: 'validation error'},
            401: {description: 'authorization error'},
            500: {description: 'internal server error'}
          }
        };
      case 'post':
        return {
          ...baseSpecification,
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
            400: {description: 'validation error'},
            401: {description: 'authorization error'},
            500: {description: 'internal server error'}
          }
        };
      case 'delete':
        return {
          ...baseSpecification,
          summary: 'Removes all associations',
          description: 'Removes all associations',
          parameters: [this.idParameter],
          responses: {
            204: EMPTY_RESPONSE,
            401: {description: 'authorization error'},
            404: {description: 'entity not found'},
            500: {description: 'internal server error'}
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
    const baseSpecification = this.createBasePathSpecification(`/:id/${targetPath || target.name}/count`, 'get');
    return {
      ...baseSpecification,
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
        401: {description: 'authorization error'},
        500: {description: 'internal server error'}
      }
    };
  }

  createSearchHasManyOrBelongsToManyPathSpecfication(target, targetPath) {
    if (!target) {
      throw new Error('target must not be null');
    }
    const targetRef = {$ref: `#/components/schemas/${target.name}`};
    const baseSpecification = this.createBasePathSpecification(`/:id/${targetPath || target.name}/search`, 'post');
    return {
      ...baseSpecification,
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
        400: {description: 'validation error'},
        401: {description: 'authorization error'},
        500: {description: 'internal server error'}
      }
    };
  }

  createHasManyOrBelongsToManyInstancePathSpecfication(operation, target, targetPath) {
    if (!target) {
      throw new Error('target must not be null');
    }
    const path = `/:id/${targetPath || target.name}/:targetId`;
    const targetRef = {$ref: `#/components/schemas/${target.name}`};
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
            400: {description: 'validation error'},
            401: {description: 'authorization error'},
            500: {description: 'internal server error'}
          }
        };
      case 'put':
        return {
          ...baseSpecification,
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
            204: EMPTY_RESPONSE,
            401: {description: 'authorization error'},
            404: {description: 'entity not found'},
            500: {description: 'internal server error'}
          }
        };
      case 'patch':
        return {
          ...baseSpecification,
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
            204: EMPTY_RESPONSE,
            401: {description: 'authorization error'},
            404: {description: 'entity not found'},
            500: {description: 'internal server error'}
          }
        };
      case 'delete':
        return {
          ...baseSpecification,
          summary: `Delete the specified ${target.name} instance`,
          description: `Delete the specified ${target.name} instance`,
          parameters: [
            this.idParameter,
            targetIdParameter
          ],
          responses: {
            204: EMPTY_RESPONSE,
            401: {description: 'authorization error'},
            404: {description: 'entity not found'},
            500: {description: 'internal server error'}
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
    const baseSpecification = this.createBasePathSpecification(path, 'post');
    const targetIdParameter = {
      ...SequelizeOpenApiBuilder.createIdParameterSpecification(target),
      name: 'targetId',
      description: 'The target instance\'s id'
    };
    return {
      ...baseSpecification,
      summary: `Link existing ${this.model.name} and ${target.name} instances`,
      description: `Link existing ${this.model.name} and ${target.name} instances`,
      parameters: [
        this.idParameter,
        targetIdParameter
      ],
      responses: {
        204: EMPTY_RESPONSE,
        401: {description: 'authorization error'},
        404: {description: 'entity not found'},
        500: {description: 'internal server error'}
      }
    };
  }

  createUnlinkBelongsToManyPathSpecification(target, targetPath) {
    if (!target) {
      throw new Error('target must not be null');
    }
    const path = `/:id/${targetPath || target.name}/:targetId`;
    const baseSpecification = this.createBasePathSpecification(path, 'delete');
    const targetIdParameter = {
      ...SequelizeOpenApiBuilder.createIdParameterSpecification(target),
      name: 'targetId',
      description: 'The target instance\'s id'
    };
    return {
      ...baseSpecification,
      summary: `Unlink existing ${this.model.name} and ${target.name} instances`,
      description: `Unlink existing ${this.model.name} and ${target.name} instances`,
      parameters: [
        this.idParameter,
        targetIdParameter
      ],
      responses: {
        204: EMPTY_RESPONSE,
        401: {description: 'authorization error'},
        404: {description: 'entity not found'},
        500: {description: 'internal server error'}
      }
    };
  }
}

module.exports = SequelizeOpenApiBuilder;
