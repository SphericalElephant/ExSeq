'use strict';

const OpenApiBuilder = require('../openapi-builder');

const {
  HEADER_REFS,
  PARAMETER_REFS,
  REQUEST_BODY_REFS,
  RESPONSE_REFS
} = require('../openapi-exseq');
const {TYPE_MAP, convertModel} = require('./model-converter');

const ATTRIBUTE_FILTER_PARAMETER = PARAMETER_REFS.exseqAttributeFilter;
const QUERY_PARAMETERS = Object.values(PARAMETER_REFS);
const X_TOTAL_COUNT_SPECIFICATION = HEADER_REFS.exseqXTotalCount;
const SEARCH_REQUEST_BODY = REQUEST_BODY_REFS.exseqSearch;

class SequelizeOpenApiBuilder extends OpenApiBuilder {
  constructor(model, basePath, opts) {
    super(opts);
    this.model = model;
    this.basePath = basePath;
    this.createExcludeFields = opts.createExcludeFields || ['id'];
    this.tags = opts.tags || [];
    this.pathOpts = opts.pathOpts || {};
    this.modelRef = {$ref: `#/components/schemas/${model.name}`};
    this.existingSchemaNames = [];
  }

  static createIdParameterSpecification(model, target) {
    if (Object.keys(model.primaryKeys).length != 1) {
      throw new Error(`Model must have exactly one primary key field. Model: ${model.name}`);
    }
    const parameter = {
      name: target ? 'targetId' : 'id',
      in: 'path',
      description: target ? 'The target instance\'s id.' : 'The instance\'s id.',
      required: true,
      schema: TYPE_MAP[model.primaryKeys[Object.keys(model.primaryKeys)[0]].type.constructor.name]
    };
    const idType = parameter.schema.format ? parameter.schema.format : parameter.schema.type;
    const name = `exseq${target ? 'Target' : ''}IdParameter${idType.toUpperCase()}`;
    return {
      name,
      parameter,
      ref: {
        $ref: `#/components/parameters/${name}`
      }
    };
  }

  static convert(model) {
    return convertModel(model);
  }

  static createModelSchemasRecursive(model, existingSchemas) {
    let schemas = {...existingSchemas};
    if (!schemas[model.name]) {
      const schema = SequelizeOpenApiBuilder.convert(model);

      const createExcludeFields = new Set(model.getModelOpts().createExcludeFields || ['id', 'createdAt', 'updatedAt']);
      const createRequired = Array.from(new Set([...schema.required].filter(r => !createExcludeFields.has(r))));
      const createSchema = {...schema, required: createRequired};
      if (!createRequired.length) {
        delete createSchema.required;
      }

      const optionalSchema = {...schema};
      delete optionalSchema.required;

      schemas[model.name] = schema;
      schemas[SequelizeOpenApiBuilder.createCreateModelSchemaName(model)] = createSchema;
      schemas[SequelizeOpenApiBuilder.createOptionalModelSchemaName(model)] = optionalSchema;
    }
    for (const associationName in model.getAssociations()) {
      const targetModel = model.getAssociationTargetByName(associationName);
      if (!schemas[targetModel.name]) {
        schemas = SequelizeOpenApiBuilder.createModelSchemasRecursive(targetModel, schemas);
      }
    }
    return schemas;
  }

  static createCreateModelSchemaName(model) {
    return `${model.name}Create`;
  }

  static createOptionalModelSchemaName(model) {
    return `${model.name}Optional`;
  }

  createModelRequestBody(model, operation, array = false) {
    let requestBodyName = `${model.name}`;
    const modelRef = {$ref: `#/components/schemas/${model.name}`};
    if (operation === 'post') {
      const createModelName = SequelizeOpenApiBuilder.createCreateModelSchemaName(model);
      if (this.existingSchemaNames.includes(createModelName)) {
        requestBodyName = createModelName;
        modelRef.$ref = `#/components/schemas/${createModelName}`;
      }
    } else if (operation !== 'put') {
      const optionalModelName = SequelizeOpenApiBuilder.createOptionalModelSchemaName(model);
      if (this.existingSchemaNames.includes(optionalModelName)) {
        requestBodyName = optionalModelName;
        modelRef.$ref = `#/components/schemas/${optionalModelName}`;
      }
    }
    const result = {
      name: requestBodyName,
      required: true,
      ref: {$ref: `#/components/requestBodies/${requestBodyName}`}
    };

    if (array) {
      result.requestBody = {
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: {
                $ref: modelRef.$ref
              }
            }
          }
        }
      };
    } else {
      result.requestBody = {
        content: {
          'application/json': {schema: modelRef}
        }
      };
    }

    return result;
  }

  createModelInstanceResponse(model, operation) {
    let schemaName = `${model.name}Response`;
    let responseName = `${model.name}`;
    const modelRef = {$ref: `#/components/schemas/${model.name}`};
    if (operation === 'get') {
      const optionalSchemaName = SequelizeOpenApiBuilder.createOptionalModelSchemaName(model);
      if (this.existingSchemaNames.includes(optionalSchemaName)) {
        schemaName = `${optionalSchemaName}Response`;
        responseName = optionalSchemaName;
        modelRef.$ref = `#/components/schemas/${optionalSchemaName}`;
      }
    }
    return {
      schemaName,
      responseName,
      schema: {
        type: 'object',
        properties: {
          status: {
            type: 'integer'
          },
          message: {
            type: 'string'
          },
          payload: modelRef
        }
      },
      response: {
        description: `A ${model.name} instance.`,
        content: {
          'application/json': {
            schema: {
              $ref: `#/components/schemas/${schemaName}`
            }
          }
        }
      },
      ref: {
        $ref: `#/components/responses/${responseName}`
      }
    };
  }

  createModelArrayResponse(model) {
    let schemaName = `${model.name}ArrayResponse`;
    let responseName = `${model.name}Array`;
    const modelRef = {$ref: `#/components/schemas/${model.name}`};
    const optionalSchemaName = SequelizeOpenApiBuilder.createOptionalModelSchemaName(model);
    if (this.existingSchemaNames.includes(optionalSchemaName)) {
      schemaName = `${schemaName}ArrayResponse`;
      responseName = `${optionalSchemaName}Array`;
      modelRef.$ref = `#/components/schemas/${optionalSchemaName}`;
    }
    return {
      schemaName,
      responseName,
      schema: {
        type: 'object',
        properties: {
          status: {
            type: 'integer'
          },
          message: {
            type: 'string'
          },
          payload: {
            type: 'array',
            items: modelRef
          }
        }
      },
      response: {
        description: `An array containing ${model.name} instances.`,
        content: {
          'application/json': {
            schema: {
              $ref: `#/components/schemas/${schemaName}`
            }
          }
        }
      },
      ref: {
        $ref: `#/components/responses/${responseName}`
      }
    };
  }

  createModelSearchResponse(model, empty) {
    let schemaName = `${model.name}SearchResponse`;
    let responseName = empty ? `${model.name}SearchEmpty` : `${model.name}Search`;
    const description = empty ? 'No instances found' : `Found instances of ${this.model.name}`;
    const modelRef = {$ref: `#/components/schemas/${model.name}`};
    const optionalSchemaName = SequelizeOpenApiBuilder.createOptionalModelSchemaName(model);
    if (this.existingSchemaNames.includes(optionalSchemaName)) {
      schemaName = `${optionalSchemaName}SearchResponse`;
      responseName = empty ? `${optionalSchemaName}SearchEmpty` : `${optionalSchemaName}Search`;
      modelRef.$ref = `#/components/schemas/${optionalSchemaName}`;
    }
    return {
      schemaName,
      responseName,
      schema: {
        type: 'object',
        properties: {
          status: {
            type: 'integer'
          },
          message: {
            type: 'string'
          },
          payload: {
            type: 'array',
            items: modelRef
          }
        }
      },
      response: {
        description,
        content: {
          'application/json': {
            schema: {
              $ref: `#/components/schemas/${schemaName}`
            }
          }
        },
        headers: {
          'X-Total-Count': X_TOTAL_COUNT_SPECIFICATION
        }
      },
      ref: {
        $ref: `#/components/responses/${responseName}`
      }
    };
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
    const components = {schemas: {}, responses: {}, requestBodies: {}};
    switch (operation) {
      case 'get':
        const getResponse = this.createModelArrayResponse(this.model);
        components.responses[getResponse.responseName] = getResponse.response;
        components.schemas[getResponse.schemaName] = getResponse.schema;
        return {
          operation: {
            ...baseSpecification,
            operationId: pathOpts.operationId || `get-${this.model.name}`,
            summary: `Obtain all instances of ${this.model.name}`,
            description: `Obtain all instances of ${this.model.name}`,
            parameters: QUERY_PARAMETERS,
            responses: {
              200: getResponse.ref,
              400: RESPONSE_REFS.exseqInvalidInput,
              401: RESPONSE_REFS.exseqUnauthorized,
              500: RESPONSE_REFS.exseqUnexpectedError
            }
          },
          components
        };
      case 'post':
        const requestBody = this.createModelRequestBody(this.model, operation);
        components.requestBodies[requestBody.name] = requestBody.requestBody;
        const postResponse = this.createModelInstanceResponse(this.model, operation);
        components.responses[postResponse.responseName] = postResponse.response;
        components.schemas[postResponse.schemaName] = postResponse.schema;
        return {
          operation: {
            ...baseSpecification,
            operationId: pathOpts.operationId || `create-${this.model.name}`,
            summary: `Create a new ${this.model.name} instance`,
            description: `Create a new ${this.model.name} instance`,
            requestBody: requestBody.ref,
            responses: {
              201: postResponse.ref,
              400: RESPONSE_REFS.exseqInvalidInput,
              401: RESPONSE_REFS.exseqUnauthorized,
              500: RESPONSE_REFS.exseqUnexpectedError
            }
          },
          components
        };
      default: throw new Error(`Operation ${operation} not supported for path '/'`);
    }
  }

  createBulkModelPathSpecification() {
    const path = '/bulk';
    const operation = 'post';
    const pathOpts = this.getPathOptions(path)[operation] || {};
    const baseSpecification = this.createBasePathSpecification(path, operation);
    const components = {schemas: {}, responses: {}, requestBodies: {}};

    const requestBody = this.createModelRequestBody(this.model, operation, true);
    components.requestBodies[requestBody.name] = requestBody.requestBody;
    const postResponse = this.createModelArrayResponse(this.model);
    components.responses[postResponse.responseName] = postResponse.response;
    components.schemas[postResponse.schemaName] = postResponse.schema;
    return {
      operation: {
        ...baseSpecification,
        operationId: pathOpts.operationId || `bulk-create-${this.model.name}`,
        summary: `Creates new ${this.model.name} instances in bulk`,
        description: `Creates new ${this.model.name} instances in bulk`,
        requestBody: requestBody.requestBody,
        responses: {
          201: postResponse.ref,
          400: RESPONSE_REFS.exseqInvalidInput,
          401: RESPONSE_REFS.exseqUnauthorized,
          500: RESPONSE_REFS.exseqUnexpectedError
        }
      },
      components
    };
  }

  createCountModelPathSpecification() {
    const path = '/count';
    const operation = 'get';
    const pathOpts = this.getPathOptions(path)[operation] || {};
    const baseSpecification = this.createBasePathSpecification(path, operation);
    return {
      operation: {
        ...baseSpecification,
        operationId: pathOpts.operationId || `count-${this.model.name}`,
        summary: `Obtains the count of all ${this.model.name} entities`,
        description: `Obtains the count of all ${this.model.name} entities`,
        responses: {
          200: RESPONSE_REFS.exseqCount,
          401: RESPONSE_REFS.exseqUnauthorized,
          500: RESPONSE_REFS.exseqUnexpectedError
        }
      },
      components: {}
    };
  }

  createSearchModelPathSpecification() {
    const path = '/search';
    const operation = 'post';
    const pathOpts = this.getPathOptions(path)[operation] || {};
    const baseSpecification = this.createBasePathSpecification(path, operation);
    const response = this.createModelSearchResponse(this.model, false);
    const emptyResponse = this.createModelSearchResponse(this.model, true);
    const components = {schemas: {}, responses: {}};
    components.schemas[response.schemaName] = response.schema;
    components.responses[response.responseName] = response.response;
    components.schemas[emptyResponse.schemaName] = emptyResponse.schema;
    components.responses[emptyResponse.responseName] = emptyResponse.response;
    return {
      operation: {
        ...baseSpecification,
        operationId: pathOpts.operationId || `search-${this.model.name}`,
        summary: `Search the ${this.model.name} table`,
        description: `Search the ${this.model.name} table`,
        requestBody: SEARCH_REQUEST_BODY,
        responses: {
          200: response.ref,
          204: emptyResponse.ref,
          400: RESPONSE_REFS.exseqInvalidInput,
          401: RESPONSE_REFS.exseqUnauthorized,
          500: RESPONSE_REFS.exseqUnexpectedError
        }
      },
      components
    };
  }

  createInstancePathSpecification(operation) {
    const path = '/:id';
    const pathOpts = this.getPathOptions(path)[operation] || {};
    const baseSpecification = this.createBasePathSpecification(path, operation);
    const components = {schemas: {}, responses: {}, requestBodies: {}, parameters: {}};
    const idParameter = SequelizeOpenApiBuilder.createIdParameterSpecification(this.model, false);
    components.parameters[idParameter.name] = idParameter.parameter;
    switch (operation) {
      case 'get':
        const getResponse = this.createModelInstanceResponse(this.model, operation);
        components.schemas[getResponse.schemaName] = getResponse.schema;
        components.responses[getResponse.responseName] = getResponse.response;
        return {
          operation: {
            ...baseSpecification,
            operationId: pathOpts.operationId || `get-${this.model.name}-by-id`,
            summary: `Obtain the specified ${this.model.name} instance`,
            description: `Obtain the specified ${this.model.name} instance`,
            parameters: [idParameter.ref, ATTRIBUTE_FILTER_PARAMETER],
            responses: {
              200: getResponse.ref,
              401: RESPONSE_REFS.exseqUnauthorized,
              404: RESPONSE_REFS.exseqNotFound,
              500: RESPONSE_REFS.exseqUnexpectedError
            }
          },
          components
        };
      case 'put':
        const putRequestBody = this.createModelRequestBody(this.model, operation);
        components.requestBodies[putRequestBody.name] = putRequestBody.requestBody;
        return {
          operation: {
            ...baseSpecification,
            operationId: pathOpts.operationId || `update-${this.model.name}-by-id`,
            summary: `Replace all values of the specified ${this.model.name} instance`,
            description: `Replace all values of the specified ${this.model.name} instance`,
            parameters: [idParameter.ref],
            requestBody: putRequestBody.ref,
            responses: {
              204: RESPONSE_REFS.exseqEmpty,
              401: RESPONSE_REFS.exseqUnauthorized,
              404: RESPONSE_REFS.exseqNotFound,
              500: RESPONSE_REFS.exseqUnexpectedError
            }
          },
          components
        };
      case 'patch':
        const patchRequestBody = this.createModelRequestBody(this.model, operation);
        components.requestBodies[patchRequestBody.name] = patchRequestBody.requestBody;
        return {
          operation: {
            ...baseSpecification,
            operationId: pathOpts.operationId || `update-partial-${this.model.name}-by-id`,
            summary: `Replace selected values of the specified ${this.model.name} instance`,
            description: `Replace selected values of the specified ${this.model.name} instance`,
            parameters: [idParameter.ref],
            requestBody: patchRequestBody.ref,
            responses: {
              204: RESPONSE_REFS.exseqEmpty,
              401: RESPONSE_REFS.exseqUnauthorized,
              404: RESPONSE_REFS.exseqNotFound,
              500: RESPONSE_REFS.exseqUnexpectedError
            }
          },
          components
        };
      case 'delete':
        return {
          operation: {
            ...baseSpecification,
            operationId: pathOpts.operationId || `delete-${this.model.name}-by-id`,
            summary: `Delete the specified ${this.model.name} instance`,
            description: `Delete the specified ${this.model.name} instance`,
            parameters: [idParameter.ref],
            responses: {
              204: RESPONSE_REFS.exseqEmpty,
              401: RESPONSE_REFS.exseqUnauthorized,
              404: RESPONSE_REFS.exseqNotFound,
              500: RESPONSE_REFS.exseqUnexpectedError
            }
          },
          components
        };
      default: throw new Error(`Operation ${operation} not supported for path ${path}`);
    }
  }

  createHasOneOrBelongsToPathSpecification(operation, target, targetPath) {
    if (!target) {
      throw new Error('target must not be null');
    }
    const path = `/:id/${targetPath || target.name}`;
    const pathOpts = this.getPathOptions(path)[operation] || {};
    const baseSpecification = this.createBasePathSpecification(path, operation);
    const components = {schemas: {}, responses: {}, requestBodies: {}, parameters: {}};
    const idParameter = SequelizeOpenApiBuilder.createIdParameterSpecification(this.model, false);
    components.parameters[idParameter.name] = idParameter.parameter;
    switch (operation) {
      case 'get':
        const getResponse = this.createModelInstanceResponse(target, operation);
        components.responses[getResponse.responseName] = getResponse.response;
        components.schemas[getResponse.schemaName] = getResponse.schema;
        return {
          operation: {
            ...baseSpecification,
            operationId: pathOpts.operationId || `get-${target.name}-by-${this.model.name}-id`,
            summary: `Get the ${target.name} instance of the ${this.model.name} instance`,
            description: `Get the ${target.name} instance of the ${this.model.name} instance`,
            parameters: [idParameter.ref],
            responses: {
              200: getResponse.ref,
              400: RESPONSE_REFS.exseqInvalidInput,
              401: RESPONSE_REFS.exseqUnauthorized,
              500: RESPONSE_REFS.exseqUnexpectedError
            }
          },
          components
        };
      case 'post':
        const postRequestBody = this.createModelRequestBody(target, operation);
        const postResponse = this.createModelInstanceResponse(target, operation);
        components.requestBodies[postRequestBody.name] = postRequestBody.requestBody;
        components.responses[postResponse.responseName] = postResponse.response;
        components.schemas[postResponse.schemaName] = postResponse.schema;
        return {
          operation: {
            ...baseSpecification,
            operationId: pathOpts.operationId || `create-${target.name}-by-${this.model.name}-id`,
            summary: `Create a new ${target.name} instance and associate it with ${this.model.name}`,
            description: `Create a new ${target.name} instance and associate it with ${this.model.name}`,
            parameters: [idParameter.ref],
            requestBody: postRequestBody.ref,
            responses: {
              201: postResponse.ref,
              400: RESPONSE_REFS.exseqInvalidInput,
              401: RESPONSE_REFS.exseqUnauthorized,
              500: RESPONSE_REFS.exseqUnexpectedError
            }
          },
          components
        };
      case 'put':
        const putRequestBody = this.createModelRequestBody(target, operation);
        components.requestBodies[putRequestBody.name] = putRequestBody.requestBody;
        return {
          operation: {
            ...baseSpecification,
            operationId: pathOpts.operationId || `update-${target.name}-by-${this.model.name}-id`,
            summary: `Replace all values of the ${target.name} instance`,
            description: `Replace all values of the ${target.name} instance`,
            parameters: [idParameter.ref],
            requestBody: putRequestBody.ref,
            responses: {
              204: RESPONSE_REFS.exseqEmpty,
              401: RESPONSE_REFS.exseqUnauthorized,
              404: RESPONSE_REFS.exseqNotFound,
              500: RESPONSE_REFS.exseqUnexpectedError
            }
          },
          components
        };
      case 'patch':
        const patchRequestBody = this.createModelRequestBody(target, operation);
        components.requestBodies[patchRequestBody.name] = patchRequestBody.requestBody;
        return {
          operation: {
            ...baseSpecification,
            operationId: pathOpts.operationId || `update-partial-${target.name}-by-${this.model.name}-id`,
            summary: `Replace selected values of the ${target.name} instance`,
            description: `Replace selected values of the ${target.name} instance`,
            parameters: [idParameter.ref],
            requestBody: patchRequestBody.ref,
            responses: {
              204: RESPONSE_REFS.exseqEmpty,
              401: RESPONSE_REFS.exseqUnauthorized,
              404: RESPONSE_REFS.exseqNotFound,
              500: RESPONSE_REFS.exseqUnexpectedError
            }
          },
          components
        };
      case 'delete':
        return {
          operation: {
            ...baseSpecification,
            operationId: pathOpts.operationId || `delete-${target.name}-by-${this.model.name}-id`,
            summary: 'Remove the association',
            description: 'Remove the association',
            parameters: [idParameter.ref],
            responses: {
              204: RESPONSE_REFS.exseqEmpty,
              401: RESPONSE_REFS.exseqUnauthorized,
              404: RESPONSE_REFS.exseqNotFound,
              500: RESPONSE_REFS.exseqUnexpectedError
            }
          },
          components
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
    const pathOpts = this.getPathOptions(path)[operation] || {};
    const baseSpecification = this.createBasePathSpecification(path, operation);
    const components = {schemas: {}, responses: {}, requestBodies: {}, parameters: {}};
    const idParameter = SequelizeOpenApiBuilder.createIdParameterSpecification(this.model, false);
    components.parameters[idParameter.name] = idParameter.parameter;
    switch (operation) {
      case 'get':
        const getResponse = this.createModelArrayResponse(target);
        components.schemas[getResponse.schemaName] = getResponse.schema;
        components.responses[getResponse.responseName] = getResponse.response;
        return {
          operation: {
            ...baseSpecification,
            operationId: pathOpts.operationId || `get-${target.name}-by-${this.model.name}-id`,
            summary: `Obtains an array of all associated ${target.name} instances`,
            description: `Obtains an array of all associated ${target.name} instances`,
            parameters: [idParameter.ref, ATTRIBUTE_FILTER_PARAMETER],
            responses: {
              200: getResponse.ref,
              400: RESPONSE_REFS.exseqInvalidInput,
              401: RESPONSE_REFS.exseqUnauthorized,
              500: RESPONSE_REFS.exseqUnexpectedError
            }
          },
          components
        };
      case 'post':
        const postRequestBody = this.createModelRequestBody(target, operation);
        const postResponse = this.createModelInstanceResponse(target, operation);
        components.requestBodies[postRequestBody.name] = postRequestBody.requestBody;
        components.schemas[postResponse.schemaName] = postResponse.schema;
        components.responses[postResponse.responseName] = postResponse.response;
        return {
          operation: {
            ...baseSpecification,
            operationId: pathOpts.operationId || `create-${target.name}-by-${this.model.name}-id`,
            summary: `Creates and associates a new ${target.name} instance`,
            description: `Creates and associates a new ${target.name} instance`,
            parameters: [idParameter.ref],
            requestBody: postRequestBody.ref,
            responses: {
              201: postResponse.ref,
              400: RESPONSE_REFS.exseqInvalidInput,
              401: RESPONSE_REFS.exseqUnauthorized,
              500: RESPONSE_REFS.exseqUnexpectedError
            }
          },
          components
        };
      case 'delete':
        return {
          operation: {
            ...baseSpecification,
            operationId: pathOpts.operationId || `delete-${target.name}-by-${this.model.name}-id`,
            summary: 'Removes all associations',
            description: 'Removes all associations',
            parameters: [idParameter.ref],
            responses: {
              204: RESPONSE_REFS.exseqEmpty,
              401: RESPONSE_REFS.exseqUnauthorized,
              404: RESPONSE_REFS.exseqNotFound,
              500: RESPONSE_REFS.exseqUnexpectedError
            }
          },
          components
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
    const components = {parameters: {}};
    const idParameter = SequelizeOpenApiBuilder.createIdParameterSpecification(this.model, false);
    components.parameters[idParameter.name] = idParameter.parameter;
    return {
      operation: {
        ...baseSpecification,
        operationId: pathOpts.operationId || `count-${target.name}-by-${this.model.name}-id`,
        summary: `Obtains the count of all ${target.name} entities`,
        description: `Obtains the count of all ${target.name} entities`,
        parameters: [idParameter.ref],
        responses: {
          200: RESPONSE_REFS.exseqCount,
          401: RESPONSE_REFS.exseqUnauthorized,
          500: RESPONSE_REFS.exseqUnexpectedError
        }
      },
      components
    };
  }

  createSearchHasManyOrBelongsToManyPathSpecfication(target, targetPath) {
    if (!target) {
      throw new Error('target must not be null');
    }
    const path = `/:id/${targetPath || target.name}/search`;
    const operation = 'post';
    const pathOpts = this.getPathOptions(path)[operation] || {};
    const baseSpecification = this.createBasePathSpecification(path, operation);
    const components = {schemas: {}, responses: {}, parameters: {}};
    const idParameter = SequelizeOpenApiBuilder.createIdParameterSpecification(this.model, false);
    const response = this.createModelSearchResponse(target, false);
    const emptyResponse = this.createModelSearchResponse(target, true);
    components.schemas[response.schemaName] = response.schema;
    components.schemas[emptyResponse.schemaName] = emptyResponse.schema;
    components.responses[response.responseName] = response.response;
    components.responses[emptyResponse.responseName] = emptyResponse.response;
    components.parameters[idParameter.name] = idParameter.parameter;
    return {
      operation: {
        ...baseSpecification,
        operationId: pathOpts.operationId || `search-${target.name}-by-${this.model.name}-id`,
        summary: `Search items in the ${target.name} table that are related to ${this.model.name}`,
        description: `Search items in the ${target.name} table that are related to ${this.model.name}`,
        parameters: [idParameter.ref],
        requestBody: SEARCH_REQUEST_BODY,
        responses: {
          200: response.ref,
          204: emptyResponse.ref,
          400: RESPONSE_REFS.exseqInvalidInput,
          401: RESPONSE_REFS.exseqUnauthorized,
          500: RESPONSE_REFS.exseqUnexpectedError
        }
      },
      components
    };
  }

  createHasManyOrBelongsToManyInstancePathSpecfication(operation, target, targetPath) {
    if (!target) {
      throw new Error('target must not be null');
    }
    const path = `/:id/${targetPath || target.name}/:targetId`;
    const pathOpts = this.getPathOptions(path)[operation] || {};
    const baseSpecification = this.createBasePathSpecification(path, operation);
    const components = {schemas: {}, responses: {}, requestBodies: {}, parameters: {}};
    const idParameter = SequelizeOpenApiBuilder.createIdParameterSpecification(this.model, false);
    const targetIdParameter = SequelizeOpenApiBuilder.createIdParameterSpecification(target, true);
    components.parameters[idParameter.name] = idParameter.parameter;
    components.parameters[targetIdParameter.name] = targetIdParameter.parameter;
    switch (operation) {
      case 'get':
        const getResponse = this.createModelInstanceResponse(target, operation);
        components.schemas[getResponse.schemaName] = getResponse.schema;
        components.responses[getResponse.responseName] = getResponse.response;
        return {
          operation: {
            ...baseSpecification,
            operationId: pathOpts.operationId || `get-${target.name}-by-${this.model.name}-id-and-target-id`,
            summary: `Obtains a single ${target.name} instance`,
            description: `Obtains a single ${target.name} instance`,
            parameters: [idParameter.ref, targetIdParameter.ref, ATTRIBUTE_FILTER_PARAMETER],
            responses: {
              200: getResponse.ref,
              400: RESPONSE_REFS.exseqInvalidInput,
              401: RESPONSE_REFS.exseqUnauthorized,
              500: RESPONSE_REFS.exseqUnexpectedError
            }
          },
          components
        };
      case 'put':
        const putRequestBody = this.createModelRequestBody(target, operation);
        components.requestBodies[putRequestBody.name] = putRequestBody.requestBody;
        return {
          operation: {
            ...baseSpecification,
            operationId: pathOpts.operationId || `update-${target.name}-by-${this.model.name}-id-and-target-id`,
            summary: `Replace all values of the ${target.name} instance`,
            description: `Replace all values of the specified ${target.name} instance`,
            parameters: [idParameter.ref, targetIdParameter.ref],
            requestBody: putRequestBody.ref,
            responses: {
              204: RESPONSE_REFS.exseqEmpty,
              401: RESPONSE_REFS.exseqUnauthorized,
              404: RESPONSE_REFS.exseqNotFound,
              500: RESPONSE_REFS.exseqUnexpectedError
            }
          },
          components
        };
      case 'patch':
        const patchRequestBody = this.createModelRequestBody(target, operation);
        components.requestBodies[patchRequestBody.name] = patchRequestBody.requestBody;
        return {
          operation: {
            ...baseSpecification,
            operationId: pathOpts.operationId || `update-partial-${target.name}-by-${this.model.name}-id-and-target-id`,
            summary: `Replace selected values of the ${target.name} instance`,
            description: `Replace selected values of the ${target.name} instance`,
            parameters: [idParameter.ref, targetIdParameter.ref],
            requestBody: patchRequestBody.ref,
            responses: {
              204: RESPONSE_REFS.exseqEmpty,
              401: RESPONSE_REFS.exseqUnauthorized,
              404: RESPONSE_REFS.exseqNotFound,
              500: RESPONSE_REFS.exseqUnexpectedError
            }
          },
          components
        };
      case 'delete':
        return {
          operation: {
            ...baseSpecification,
            operationId: pathOpts.operationId || `delete-${target.name}-by-${this.model.name}-id-and-target-id`,
            summary: `Delete the specified ${target.name} instance`,
            description: `Delete the specified ${target.name} instance`,
            parameters: [idParameter.ref, targetIdParameter.ref],
            responses: {
              204: RESPONSE_REFS.exseqEmpty,
              401: RESPONSE_REFS.exseqUnauthorized,
              404: RESPONSE_REFS.exseqNotFound,
              500: RESPONSE_REFS.exseqUnexpectedError
            }
          },
          components
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
    const components = {parameters: {}};
    const idParameter = SequelizeOpenApiBuilder.createIdParameterSpecification(this.model, false);
    const targetIdParameter = SequelizeOpenApiBuilder.createIdParameterSpecification(target, true);
    components.parameters[idParameter.name] = idParameter.parameter;
    components.parameters[targetIdParameter.name] = targetIdParameter.parameter;
    return {
      operation: {
        ...baseSpecification,
        operationId: pathOpts.operationId || `link-${target.name}-by-${this.model.name}-id-and-target-id`,
        summary: `Link existing ${this.model.name} and ${target.name} instances`,
        description: `Link existing ${this.model.name} and ${target.name} instances`,
        parameters: [idParameter.ref, targetIdParameter.ref],
        responses: {
          204: RESPONSE_REFS.exseqEmpty,
          401: RESPONSE_REFS.exseqUnauthorized,
          404: RESPONSE_REFS.exseqNotFound,
          500: RESPONSE_REFS.exseqUnexpectedError
        }
      },
      components
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
    const components = {parameters: {}};
    const idParameter = SequelizeOpenApiBuilder.createIdParameterSpecification(this.model, false);
    const targetIdParameter = SequelizeOpenApiBuilder.createIdParameterSpecification(target, true);
    components.parameters[idParameter.name] = idParameter.parameter;
    components.parameters[targetIdParameter.name] = targetIdParameter.parameter;
    return {
      operation: {
        ...baseSpecification,
        operationId: pathOpts.operationId || `unlink-${target.name}-by-${this.model.name}-id-and-target-id`,
        summary: `Unlink existing ${this.model.name} and ${target.name} instances`,
        description: `Unlink existing ${this.model.name} and ${target.name} instances`,
        parameters: [idParameter.ref, targetIdParameter.ref],
        responses: {
          204: RESPONSE_REFS.exseqEmpty,
          401: RESPONSE_REFS.exseqUnauthorized,
          404: RESPONSE_REFS.exseqNotFound,
          500: RESPONSE_REFS.exseqUnexpectedError
        }
      },
      components
    };
  }
}

module.exports = SequelizeOpenApiBuilder;
