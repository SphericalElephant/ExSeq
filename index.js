'use strict';

const express = require('express');
const sequelize = require('sequelize');
const _ = require('lodash');
const modelExtension = require('./lib/model');
const {openapi, convertModel, TYPE_MAP} = require('./lib/openapi/sequelize');
const relationShipMiddlewareFactory = require('./middleware/relationship');

require('./lib/string');

// OPEN API STUFF
const ATTRIBUTE_FILTER_PARAMETER = {
  name: 'a',
  in: 'query',
  description: 'Allows attribute filtering.',
  required: false,
  schema: {
    type: 'string',
    description: '"|" separated list of Strings'
  },
  example: '/person/?a=name|birthdate|email'
};
const QUERY_PARAMETERS = [
  ATTRIBUTE_FILTER_PARAMETER,
  {
    name: 'i',
    in: 'query',
    description: 'Items per page (pagination). See also: parameter "p"',
    required: false,
    schema: {
      type: 'integer',
      description: 'Integer'
    },
    example: {i: 10, p: 2}
  },
  {
    name: 'p',
    in: 'query',
    description: 'Page (pagination). See also: parameter "i"',
    required: false,
    schema: {
      type: 'integer',
      description: 'Integer'
    },
    example: {i: 10, p: 2}
  },
  {
    name: 'f',
    in: 'query',
    description: 'Sort by field',
    required: false,
    schema: {
      type: 'string',
      description: 'String'
    },
    example: {f: 'name'}
  },
  {
    name: 'o',
    in: 'query',
    description: 'Sort order',
    required: false,
    schema: {
      type: 'string',
      description: 'Enum(ASC/DESC)'
    },
    example: {f: 'name', o: 'ASC'}
  },
  {
    name: 's',
    in: 'query',
    description:
      `Sequelize Search Query. ExSeq supports searching in accordance to Sequelize Querying.
      Please make sure to use the backwards compatible operator notation and not the symbol notation.
      Alternatively, you may use the string representation of the symbol.`,
    required: false,
    schema: {
      type: 'object',
      description: 'JSON'
    },
    example: {s: {value: 1}},
    examples: {
      backwardCompatible: {
        value: {
          value: {
            $like: '%foo%'
          }
        }
      },
      symbolStringRepresentation: {
        value: {
          value: {
            like: '%foo%'
          }
        }
      }
    }
  }
];
const SEARCH_REQUEST_BODY = {
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: {
          a: {
            type: 'string',
            description: '"|" separated list of Strings. Allows attribute filtering.'
          },
          i: {
            type: 'integer',
            description: 'Items per page (pagination)'
          },
          p: {
            type: 'integer',
            description: 'Page (pagination)'
          },
          f: {
            type: 'string',
            description: 'Field name - Sort by field'
          },
          o: {
            type: 'string',
            description: 'Sort order - one of ["ASC", "DESC"]'
          },
          s: {
            type: 'object',
            description: 'Sequelize query',
            example: {
              value: {
                $like: '%foo%'
              }
            }
          }
        }
      }
    }
  }
}
const X_TOTAL_COUNT_SPECIFICATION = {
  description: 'Contains the count of all results for the search query',
  schema: {
    type: 'integer'
  }
};
const EMPTY_RESPONSE = {
  description: 'An empty object',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: {}
      }
    }
  }
};

class OpenApiHelper {
  constructor (model, basePath, opts) {
    this.model = model;
    this.basePath = basePath;
    this.opts = opts;
    this.idParameter = OpenApiHelper.createIdParameterSpecification(model);
    this.modelRef = {$ref: `#/components/schemas/${model.name}`};
  }

  static createIdParameterSpecification (model) {
    if (Object.keys(model.primaryKeys).length != 1) {
      throw new Error(`Model must have exactly one primary key field. Model: ${model.name}`);
    }
    return {
      name: 'id',
      in: 'path',
      description: 'The instance\'s id.',
      required: true,
      schema: {
        type: TYPE_MAP[model.primaryKeys[Object.keys(model.primaryKeys)[0]].type.constructor.name]
      }
    };
  };

  getPathOptions (path) {
    return this.opts[path] || {};
  }

  createPathItemStub (path) {
    const pathOpts = this.getPathOptions(path);
    // $ref is not supported
    return {
      summary: pathOpts.summary || this.model.name,
      description: pathOpts.description || this.model.name,
      servers: pathOpts.servers || [],
      parameters: pathOpts.parameters || []
    };
  };

  createBasePathSpecification (path, operation) {
    const pathOpts = this.getPathOptions(path)[operation] || {};
    const baseSpecification = {
      tags: ['exseq', this.model.name],
      operationId: `exseq-${path}-${operation}`,
      callbacks: pathOpts.callbacks || {},
      deprecated: pathOpts.deprecated || false,
      security: pathOpts.security || {},
      servers: pathOpts.servers || []
    };
    if (pathOpts.externalDocs) {
      baseSpecification.externalDocs = pathOpts.externalDocs;
    }
    return baseSpecification;
  }

  createModelPathSpecification (operation) {
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
              'application/json': {schema: this.modelRef},
              required: true
            }
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
    };
  }

  createCountModelPathSpecification () {
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

  createSearchModelPathSpecification () {
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

  createInstancePathSpecification (operation) {
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
              'application/json': {schema: this.modelRef},
              required: true
            }
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
              'application/json': {schema: this.modelRef}, // TODO: nothing should be required!
              required: true
            }
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
        }
      default: throw new Error(`Operation ${operation} not supported for path ${path}`);
    };
  }

  createHasOneOrBelongsToPathSpecification (operation, target, targetPath) {
    if (!target) {
      throw new Error('target must not be null');
    }
    const path = `/:id/${targetPath || target.name}`
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
              'application/json': {schema: targetRef},
              required: true
            }
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
              'application/json': {schema: targetRef},
              required: true
            }
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
              'application/json': {schema: targetRef}, // TODO: nothing should be required!
              required: true
            }
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
          summary: `Remove the association`,
          description: `Remove the association`,
          parameters: [this.idParameter],
          responses: {
            204: EMPTY_RESPONSE,
            401: {description: 'authorization error'},
            404: {description: 'entity not found'},
            500: {description: 'internal server error'}
          }
        }
      default:
        throw new Error(`Operation ${operation} not supported for path ${path}`);
    };
  }

  createHasManyOrBelongsToManyPathSpecfication (operation, target, targetPath) {
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
          ...baseSpecificationm,
          summary: `Creates and associates a new ${target.name} instance`,
          description: `Creates and associates a new ${target.name} instance`,
          parameters: [this.idParameter],
          requestBody: {
            content: {
              'application/json': {schema: targetRef},
              required: true
            }
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
          summary: `Removes all associations`,
          description: `Removes all associations`,
          parameters: [this.idParameter],
          responses: {
            204: EMPTY_RESPONSE,
            401: {description: 'authorization error'},
            404: {description: 'entity not found'},
            500: {description: 'internal server error'}
          }
        }
      default:
        throw new Error(`Operation ${operation} not supported for path ${path}`);
    };
  }

  createCountHasManyOrBelongsToManyPathSpecfication (target, targetPath) {
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

  createSearchHasManyOrBelongsToManyPathSpecfication (target, targetPath) {
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

  createHasManyOrBelongsToManyInstancePathSpecfication (operation, target, targetPath) {
    if (!target) {
      throw new Error('target must not be null');
    }
    const path = `/:id/${targetPath || target.name}/:targetId`
    const targetRef = {$ref: `#/components/schemas/${target.name}`};
    const baseSpecification = this.createBasePathSpecification(path, operation);
    const targetIdParameter = {
      ...this.createIdParameterSpecification(target),
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
              'application/json': {schema: targetRef},
              required: true
            }
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
              'application/json': {schema: targetRef}, // TODO: nothing should be required!
              required: true
            }
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
        }
      default: throw new Error(`Operation ${operation} not supported for path ${path}`);
    }
  }
}

const _attachReply = (req, res, next, status, result, message) => {
  res.__payload = {status, result, message};
  next();
  return Promise.resolve();
};

const _handleError = (next, err) => {
  if (err instanceof sequelize.ValidationError)
    return next(_createError(400, _formatValidationError(err)));
  else if (err.isCreatedError)
    return next(err);
  else
    return next(_createError(500, err));
};

const _createErrorPromise = (status, errInput) => {
  return Promise.reject(_createError(status, errInput));
};

const _createError = (status, errInput) => {
  const err = errInput instanceof Error ? errInput : new Error(errInput);
  err.success = false;
  err.status = status;
  err.result = !(errInput instanceof Error) ? errInput : null;
  err.isCreatedError = true;
  return err;
};

const _formatValidationError = (err) => {
  return err.errors.map(error => {
    return _.pick(error, ['type', 'path', 'value']);
  });
};

const _update = async (model, req, res, next, id, createInput) => {
  const attachReply = _attachReply.bind(null, req, res, next);
  const handleError = _handleError.bind(null, next);

  const attributes = model.getUpdateableAttributes().map(attribute => attribute.attribute);
  try {
    const instance = await model.findByPk(id);
    if (!instance) await _createErrorPromise(404);
    await instance.update(createInput(req.body), {fields: attributes});
    return attachReply(204);
  } catch (err) {
    return handleError(err);
  }
};

const _updateRelation = async (source, target, association, req, res, next, id, targetId, prepareBody) => {
  const attachReply = _attachReply.bind(null, req, res, next);
  const handleError = _handleError.bind(null, next);
  try {
    const sourceInstance = await source.findByPk(id);
    const update = _update.bind(null, target);
    if (!sourceInstance) return attachReply(404, undefined, 'source not found.');
    const query =
      association.associationType === 'HasOne' || association.associationType === 'BelongsTo' ? undefined : {where: {id: targetId}};
    let targetInstance = await sourceInstance[association.accessors.get](query);
    if (!targetInstance) await _createErrorPromise(404, 'target not found.');
    if (targetInstance instanceof Array) // "many" relationsship
      targetInstance = targetInstance[0];
    await update(req, res, next, targetInstance.get({plain: true}).id, prepareBody);
  } catch (err) {
    handleError(err);
  }
};

const _obtainExcludeRule = (excludeRules, method, targetName, all) => {
  return _.find(excludeRules, (r) => r.method === method && r.relation === targetName && (r.all !== false) === (all !== false));
};

const _shouldRouteBeExposed = (excludeRules, method, targetName, all = true) => {
  return _obtainExcludeRule(excludeRules, method, targetName, all) !== undefined;
};

const _createQuery = async (req, source = 'query') => {
  const s = req[source];
  if (!s) return _createErrorPromise(500, `invalid source ${source}`);

  const limit = s.i;
  const offset = s.p;
  const attributes = s.a ? s.a.split('|') : undefined;
  const sortField = s.f;
  const sortOrder = s.o || 'DESC';

  if (sortOrder !== 'DESC' && sortOrder !== 'ASC')
    return _createErrorPromise(400, 'invalid sort order, must be DESC or ASC');

  if ((!limit || !offset) && limit !== offset) {
    return _createErrorPromise(400, 'p or i must be both undefined or both defined.');
  }

  const limitInt = parseInt(limit || 10);
  const offsetInt = parseInt(offset || 0);

  if (((limit && (isNaN(limitInt))) || limitInt < 0) ||
    ((offset && (isNaN(offsetInt))) || offsetInt < 0)) {
    return _createErrorPromise(400, 'p or i must be integers larger than 0!');
  }

  const order = sortField ? [[sortField, sortOrder]] : undefined;
  return Promise.resolve({limit: limitInt, offset: limitInt * offsetInt, attributes, order});
};

const _attachSearchToQuery = async (req, source = 'query', query) => {
  const s = req[source];
  if (!s) return _createErrorPromise(500, `invalid source ${source}`);

  const where = s.s;
  let newQuery = Object.assign({}, query);
  newQuery = Object.assign(newQuery, {where});
  return Promise.resolve(newQuery);
};

const alwaysAllowMiddleware = async (req, res, next) => next();

const _getModelOpts = (models, model) => {
  for (const modelDefinition of models) {
    if (modelDefinition.model === model) {
      return modelDefinition.opts;
    }
  }
  return {};
};

const _getParentAuthorizationForModel = (modelDefinitions, model) => {
  const authorizationMiddlewaresFound = [];
  for (const modelDefinition of modelDefinitions) {
    const authorizeForChildren = _.get(modelDefinition, 'opts.authorizeWith.options.authorizeForChildren', undefined);
    if (authorizeForChildren) {
      for (const childModelAuthDefinition of authorizeForChildren) {
        if (childModelAuthDefinition.child === model && childModelAuthDefinition.authorizeForChild) {
          authorizationMiddlewaresFound.push(_.get(modelDefinition, 'opts.authorizeWith', undefined));
        }
      }
    }
  }
  if (authorizationMiddlewaresFound.length > 1)
    throw new Error(`invalid number of middlewares expected 1, got ${authorizationMiddlewaresFound.length}!`);
  return authorizationMiddlewaresFound[0];
};

const _getAuthorizationMiddleWare = function (modelDefinitions, model, associatedModel, type) {
  const isAllowed = ['CREATE', 'READ', 'UPDATE', 'UPDATE_PARTIAL', 'DELETE', 'SEARCH', 'OTHER']
    .filter(method => method == type).length === 1;
  const opts = _getModelOpts(modelDefinitions, model);
  if (!isAllowed) {
    throw new Error(`unknown type ${type}`);
  }
  let authorizeWith = opts.authorizeWith;
  if (_.get(opts, 'authorizeWith.options.useParentForAuthorization', undefined)) {
    if (!associatedModel) throw new Error(`${model.name} specified to useParentForAuthorization but the associatedModel is null!`);
    const association = model.getAssociationByModel(associatedModel);
    if (association.associationType !== 'BelongsTo' && association.associationType !== 'BelongsToMany')
      throw new Error(
        `${model.name} has no BelongsTo / BelongsToMany association to ${associatedModel.name}, useParentForAuthorization is invalid!`
      );
    const parentOpts = _getModelOpts(modelDefinitions, associatedModel);
    authorizeWith = parentOpts.authorizeWith;
  }
  // use parent model authorization for root routes of another model
  const authorizationFromParent = _getParentAuthorizationForModel(modelDefinitions, model);
  if (authorizationFromParent) authorizeWith = authorizationFromParent;

  return authorizeWith && authorizeWith.rules ?
    (authorizeWith.rules[type] || authorizeWith.rules['OTHER'] || alwaysAllowMiddleware) :
    alwaysAllowMiddleware;
};

const _filterAttributes = (attributeString, instance) => {
  if (!attributeString) return instance;
  const attributes = attributeString ? attributeString.split('|') : undefined;
  if (instance instanceof Array) {
    return instance.map(item => {
      return _.pick(item, attributes);
    });
  } else {
    return _.pick(instance, attributes);
  }
};

const _searchBySourceIdAndTargetQuery = async (association, sourceId, targetQuery) => {
  const opts = targetQuery;
  let model;
  let include;
  if (association.associationType === 'BelongsToMany') {
    model = association.source;
    if (association.options.as) {
      include = [{model: association.target, as: association.options.as.plural}];
    } else {
      include = [association.target];
    }
  } else if (association.associationType === 'HasMany') {
    model = association.target;
    opts.where[association.foreignKeyField] = sourceId;
  }
  if (association.associationType === 'BelongsToMany') {
    const source = await model.findByPk(sourceId, {include});
    const targets = await source[association.accessors.get](opts);
    return [opts, targets.map(t => {
      const model = association.options.through.model;
      const result = t.get({plain: true});
      delete result[model.name || model];
      return result;
    })];
  } else if (association.associationType === 'HasMany') {
    return [opts, await model.findAll(opts)];
  }
};

const _countAssociations = async (association, query) => {
  const where = query ? query.where : null;
  if (association.associationType === 'HasMany') {
    return await association.target.count({where});
  } else if (association.associationType === 'BelongsToMany') {
    const includeOpts = {model: association.target, where};
    if (association.options.as) {
      includeOpts.as = association.options.as.plural;
    }
    return await association.source.count({
      include: [includeOpts]
    });
  } else {
    throw new Error('Unsupported!');
  }
};

module.exports = (models, opts) => {
  const routingInformation = [];
  opts = opts || {};
  opts.middleware = opts.middleware || {};
  const openApiDocument = opts.openApiDocument ? opts.openApiDocument : {
    openapi: '3.0.2',
    info: {
      title: 'Placeholder API',
      version: '1.0.0'
    },
    paths: [],
    components: {
      headers: {},
      schemas: {}
    }
  };

  if (!models) throw new Error('models must be set!');
  if (!(models instanceof Array)) throw new Error('models must be an array');
  // TODO: make sure that every referenced schema actually exists in openApiDocument.components.schemas
  // first pass, register all models
  models.forEach(model => {
    modelExtension(model.model);
    model.opts = model.opts || {};
    model.opts.openapi = model.opts.openapi || {};
    if (_.find(routingInformation, (i) => {
      return (i.route || i.model.model.name) === (model.opts.route || model.model.name);
    }))
      throw new Error(`model ${model.model.name} already registered`);
    const router = express.Router();
    const route = model.opts.route || model.model.name;
    routingInformation.push({
      model,
      route,
      router,
      opts: model.opts,
      openApiHelper: new OpenApiHelper(model.model, route, model.opts.openapi)
    });
    if (!openApiDocument.components.schemas[model.model.name]) {
      openApiDocument.components.schemas[model.model.name] = convertModel(model.model);
    }
  });
  // second pass, create routes for models
  routingInformation.forEach(routing => {
    const router = routing.router;
    const model = routing.model.model;
    const update = _update.bind(null, model);
    const exposedRoutes = routing.opts.exposed || {};
    const openApiHelper = routing.openApiHelper;
    
    [{path: '/'}, {path: '/count'}, {path: '/search'}, {path:'/{id}', alternative: '/:id'}].forEach(p => {
      const pathName = `${routing.route}${p.path}`.replace(/\/$/, '');
      const optName = p.alternative || p.path;
      if (!openApiDocument.paths[pathName]) {
        openApiDocument.paths[pathName] = openApiHelper.createPathItemStub(optName);
      }
    });

    const auth = _getAuthorizationMiddleWare.bind(null, models, model, null);

    if (opts.middleware.associationMiddleware) {
      const associationMiddleware = relationShipMiddlewareFactory(
        models.map(modelDefinition => modelDefinition.model), opts.middleware.associationMiddleware
      );
      router.use(associationMiddleware);
    }

    if (!exposedRoutes['/'] || !exposedRoutes['/'].post === false) {
      router.post('/', auth('CREATE'), (req, res, next) => {
        const attachReply = _attachReply.bind(null, req, res, next);
        const handleError = _handleError.bind(null, next);
        const input = model.removeIllegalAttributes(req.body);
  
        model
          .create(input)
          .then(modelInstance => {
            return attachReply(201, model.filterReferenceAttributesFromModelInstance(modelInstance.get({plain: true})));
          }).catch(err => {
            return handleError(err);
          });
      });
      if (!openApiDocument.paths[routing.route].post) {
        openApiDocument.paths[routing.route].post = openApiHelper.createModelPathSpecification('post');
      }
    }
    
    if (!exposedRoutes['/count'] || !exposedRoutes['/count'].get === false) {
      router.get('/count', auth('READ'), async (req, res, next) => {
        const attachReply = _attachReply.bind(null, req, res, next);
        const handleError = _handleError.bind(null, next);
        try {
          return attachReply(200, await model.count(), `Count for ${model.name} obtained!`);
        } catch (err) {
          return handleError(err);
        }
      });
      if (!openApiDocument.paths[`${routing.route}/count`].get) {
        openApiDocument.paths[`${routing.route}/count`].get = openApiHelper.createCountModelPathSpecification();
      }
    }

    if (!exposedRoutes['/'] || !exposedRoutes['/'].get === false) {
      router.get('/', auth('READ'), async (req, res, next) => {
        const attachReply = _attachReply.bind(null, req, res, next);
        const handleError = _handleError.bind(null, next);
        try {
          const query = await _createQuery(req, 'query');
          const results = await model.findAll(query);
          return attachReply(200, results.map(instance => instance.get({plain: true})));
        } catch (err) {
          return handleError(err);
        }
      });
      if (!openApiDocument.paths[routing.route].get) {
        openApiDocument.paths[routing.route].get = openApiHelper.createModelPathSpecification('get');
      }
    }
    
    if (!exposedRoutes['/search'] || !exposedRoutes['/search'].get === false) {
      router.post('/search', auth('SEARCH'), async (req, res, next) => {
        const attachReply = _attachReply.bind(null, req, res, next);
        const handleError = _handleError.bind(null, next);
        try {
          const query = await _createQuery(req, 'body');
          const searchQuery = await _attachSearchToQuery(req, 'body', query);
          const results = await model.findAll(searchQuery);

          res.set('X-Total-Count', await model.count(await _attachSearchToQuery(req, 'body', {})));
          if (results.length === 0) {
            return attachReply(204);
          } else {
            return attachReply(200, results.map(instance => instance.get({plain: true})));
          }
        } catch (err) {
          return handleError(err);
        }
      });
      if (!openApiDocument.paths[`${routing.route}/search`]) {
        openApiDocument.paths[`${routing.route}/search`].post = openApiHelper.createSearchModelPathSpecification();
      }
    }

    if (!exposedRoutes['/:id'] || !exposedRoutes['/:id'].get === false) {
      router.get('/:id', auth('READ'), (req, res, next) => {
        const id = req.params.id;
        if (id === 'count') {
          return next();
        }
        const attachReply = _attachReply.bind(null, req, res, next);
        const handleError = _handleError.bind(null, next);

        const attributes = req.query.a ? req.query.a.split('|') : undefined;
        model.findOne({where: {id}, attributes}).then(modelInstance => {
          if (!modelInstance) return _createErrorPromise(404, 'entity not found.');
          return attachReply(200, modelInstance);
        }).catch(err => {
          return handleError(err);
        });
      });
      if (!openApiDocument.paths[`${routing.route}/{id}`].get) {
        openApiDocument.paths[`${routing.route}/{id}`].get = openApiHelper.createInstancePathSpecification('get');
      }
    }

    if (!exposedRoutes['/:id'] || !exposedRoutes['/:id'].put === false) {
      router.put('/:id', auth('UPDATE'), async (req, res, next) => {
      await update(req, res, next, req.params.id, (body) => {
        return model.fillMissingUpdateableAttributes(null, null, model.removeIllegalAttributes(body));
      });
      });
      if (!openApiDocument.paths[`${routing.route}/{id}`].put) {
        openApiDocument.paths[`${routing.route}/{id}`].put = openApiHelper.createInstancePathSpecification('put');
      }
    }

    if (!exposedRoutes['/:id'] || !exposedRoutes['/:id'].patch === false) {
      router.patch('/:id', auth('UPDATE_PARTIAL'), async (req, res, next) => {
        await update(req, res, next, req.params.id, (body) => {
          return model.removeIllegalAttributes(body);
        });
      });
      if (!openApiDocument.paths[`${routing.route}/{id}`].patch) {
        openApiDocument.paths[`${routing.route}/{id}`].patch = openApiHelper.createInstancePathSpecification('patch');
      }
    }

    if (!exposedRoutes['/:id'] || !exposedRoutes['/:id'].delete === false) {
      router.delete('/:id', auth('DELETE'), async (req, res, next) => {
        const attachReply = _attachReply.bind(null, req, res, next);
        const handleError = _handleError.bind(null, next);
        try {
          const instance = await model.findByPk(req.params.id);
          if (!instance) await _createErrorPromise(404);
          await instance.destroy();
          return attachReply(204);
        } catch (err) {
          return handleError(err);
        }
      });
      if (!openApiDocument.paths[`${routing.route}/{id}`].delete) {
        openApiDocument.paths[`${routing.route}/{id}`].delete = openApiHelper.createInstancePathSpecification('delete'); 
      }
    }

    model.getAssociatedModelNames().forEach(associationName => {
      const association = model.getAssociationByName(associationName);
      const target = association.target;
      const source = association.source;
      const targetRoute = association.options.name.singular;
      const auth = _getAuthorizationMiddleWare.bind(null, models, target, source);

      const unlinkRelations = (req, res, next, setterFunctionName) => {
        const attachReply = _attachReply.bind(null, req, res, next);
        const handleError = _handleError.bind(null, next);

        source.findByPk(req.params.id).then(sourceInstance => {
          if (!sourceInstance) return _createErrorPromise(404, 'source not found.');
          return sourceInstance[setterFunctionName](null).then(_ => {
            return attachReply(204);
          });
        }).catch(err => {
          return handleError(err);
        });
      };
      const relationshipGet = (postProcess) => {
        return (req, res, next) => {
          const attachReply = _attachReply.bind(null, req, res, next);
          const handleError = _handleError.bind(null, next);
          source.findByPk(req.params.id).then(sourceInstance => {
            if (!sourceInstance) return _createErrorPromise(404, 'source not found.');
            return sourceInstance[association.accessors.get]().then(targetInstance => {
              if (!targetInstance) return _createErrorPromise(404, 'target not found.');
              return attachReply(200, postProcess(req, targetInstance));
            });
          }).catch(err => {
            return handleError(err);
          });
        };
      };

      const baseTargetRouteOpt = `/:id/${targetRoute}`;
      const baseTargetPath = `${routing.route}/{id}/${targetRoute}`;
      [{path: '/'}, {path: `/count`}, {path: '/search'}, {path:'/{targetId}', alternative: '/:targetId'}].forEach(p => {
        const pathName = `${baseTargetPath}${p.path}`.replace(/\/$/, '');
        const optName = `${baseTargetRouteOpt}${p.alternative || p.path}`;
        if (!openApiDocument.paths[pathName]) {
          openApiDocument.paths[pathName] = openApiHelper.createPathItemStub(optName);
        }
      });

      switch (association.associationType) {
        case 'HasOne':
        case 'BelongsTo':
          if (!exposedRoutes[baseTargetRouteOpt] || !exposedRoutes[baseTargetRouteOpt].get === false) {
            router.get(`/:id/${targetRoute}`, auth('READ'),
              relationshipGet((req, result) => _filterAttributes(req.query.a, result.get({plain: true}))));
            if (!openApiDocument.paths[baseTargetPath].get) {
              openApiDocument.paths[baseTargetPath].get = openApiHelper.createHasOneOrBelongsToPathSpecification('get', target, targetRoute);
            }
          }
          if (!exposedRoutes[baseTargetRouteOpt] || !exposedRoutes[baseTargetRouteOpt].post === false) {
            router.post(`/:id/${targetRoute}`, auth('CREATE'), (req, res, next) => {
              const attachReply = _attachReply.bind(null, req, res, next);
              const handleError = _handleError.bind(null, next);
              source.findByPk(req.params.id).then(sourceInstance => {
                if (!sourceInstance) return _createErrorPromise(404, 'source not found.');
                return sourceInstance[association.accessors.create](target.removeIllegalAttributes(req.body));
              }).then(instance => {
                if (association.associationType === 'BelongsTo') {
                  return instance[association.accessors.get]().then(createdTargetInstance => {
                    return attachReply(201, createdTargetInstance.get({plain: true}));
                  });
                } else {
                  return attachReply(201, instance.get({plain: true}));
                }
              }).catch(err => {
                return handleError(err);
              });
            });
            if (!openApiDocument.paths[baseTargetPath].post) {
              openApiDocument.paths[baseTargetPath].post = openApiHelper.createHasOneOrBelongsToPathSpecification('post', target, targetRoute);
            }
          }
          if (!exposedRoutes[baseTargetRouteOpt] || !exposedRoutes[baseTargetRouteOpt].put === false) {
            router.put(`/:id/${targetRoute}`, auth('UPDATE'), async (req, res, next) => {
              await _updateRelation(source, target, association, req, res, next, req.params.id, null, (body) => {
                return target.fillMissingUpdateableAttributes(association, source, target.removeIllegalAttributes(body));
              });
            });
            if (!openApiDocument.paths[baseTargetPath].put) {
              openApiDocument.paths[baseTargetPath].put = openApiHelper.createHasOneOrBelongsToPathSpecification('put', target, targetRoute);
            }
          }
          if (!exposedRoutes[baseTargetRouteOpt] || !exposedRoutes[baseTargetRouteOpt].patch === false) {
            router.patch(`/:id/${targetRoute}`, auth('UPDATE_PARTIAL'), async (req, res, next) => {
              await _updateRelation(source, target, association, req, res, next, req.params.id, null, (body) => {
                return target.removeIllegalAttributes(body);
              });
            });
            if (!openApiDocument.paths[baseTargetPath].patch) {
              openApiDocument.paths[baseTargetPath].patch = openApiHelper.createHasOneOrBelongsToPathSpecification('patch', target, targetRoute);
            }
          }
          if (!exposedRoutes[baseTargetRouteOpt] || !exposedRoutes[baseTargetRouteOpt].delete === false) {
            router.delete(`/:id/${targetRoute}`, auth('DELETE'), (req, res, next) => {
              unlinkRelations(req, res, next, association.accessors.set);
            });
            if (!openApiDocument.paths[baseTargetPath].delete) {
              openApiDocument.paths[baseTargetPath].delete = openApiHelper.createHasOneOrBelongsToPathSpecification('delete', target, targetRoute);
            }
          }
          break;
        case 'HasMany':
        case 'BelongsToMany':
          const instanceTargetRouteOpt = `${baseTargetRouteOpt}/:targetId`;
          const instanceTargetPath = `${baseTargetPath}/{targetId}`;
          if (!exposedRoutes[baseTargetRouteOpt] || !exposedRoutes[baseTargetRouteOpt].get === false) {
            router.get(`/:id/${targetRoute}`, auth('READ'), relationshipGet((req, result) => {
              return result.map(targetInstance => _filterAttributes(req.query.a, targetInstance.get({plain: true})));
            }));
            if (!openApiDocument.paths[baseTargetPath].get) {
              openApiDocument.paths[baseTargetPath].get = openApiHelper.createHasManyOrBelongsToManyPathSpecfication('get', target, targetRoute);
            }
          }
          if (!exposedRoutes[`${baseTargetRouteOpt}/count`] || !exposedRoutes[`${baseTargetRouteOpt}/count`].get === false) {
            router.get(`/:id/${targetRoute}/count`, auth('READ'), async (req, res, next) => {
              const attachReply = _attachReply.bind(null, req, res, next);
              const handleError = _handleError.bind(null, next);
              try {
                return attachReply(200, await _countAssociations(association), `Count for ${model.name} obtained!`);
              } catch (err) {
                return handleError(err);
              }
            });
            if (!openApiDocument.paths[`${baseTargetPath}/count`]) {
              openApiDocument.paths[`${baseTargetPath}/count`].get = openApiHelper.createCountHasManyOrBelongsToManyPathSpecfication(target, targetRoute);
            }
          }
          
          if (!exposedRoutes[`${baseTargetRouteOpt}/search`] || !exposedRoutes[`${baseTargetRouteOpt}/search`].post === false) {
            router.post(`/:id/${targetRoute}/search`, auth('SEARCH'), async (req, res, next) => {
              const attachReply = _attachReply.bind(null, req, res, next);
              const handleError = _handleError.bind(null, next);
              try {
                const query = await _createQuery(req, 'body');
                const searchQuery = await _attachSearchToQuery(req, 'body', query);
                const [searchOptions, results] = await _searchBySourceIdAndTargetQuery(association, req.params.id, searchQuery);
                res.set('X-Total-Count', await _countAssociations(association, searchOptions));
                if (results.length === 0) {
                  return attachReply(204);
                } else {
                  return attachReply(200, results);
                }
              } catch (err) {
                return handleError(err);
              }
            });
            if (!openApiDocument.paths[`${baseTargetPath}/search`]) {
              openApiDocument.paths[`${baseTargetPath}/search`].post = openApiHelper.createSearchHasManyOrBelongsToManyPathSpecfication(target, targetRoute);
            }
          }

          if (!exposedRoutes[instanceTargetRouteOpt] || !exposedRoutes[instanceTargetRouteOpt].get === false) {
            router.get(`/:id/${targetRoute}/:targetId`, auth('READ'), (req, res, next) => {
              if (req.params.targetId === 'count') {
                return next();
              }
              const attachReply = _attachReply.bind(null, req, res, next);
              const handleError = _handleError.bind(null, next);
              source.findByPk(req.params.id).then(sourceInstance => {
                if (!sourceInstance) return _createErrorPromise(404, 'source not found.');
                return sourceInstance[association.accessors.get]({where: {id: {$eq: req.params.targetId}}}).spread(targetInstance => {
                  if (!targetInstance) return _createErrorPromise(404, 'target not found.');
                  return attachReply(200, _filterAttributes(req.query.a, targetInstance.get({plain: true})));
                });
              }).catch(err => {
                return handleError(err);
              });
            });
            if (!openApiDocument.paths[instanceTargetPath]) {
              openApiDocument.paths[instanceTargetPath].get = openApiHelper
                .createHasManyOrBelongsToManyInstancePathSpecfication('get', target, targetRoute);
            }
          }

          if (!exposedRoutes[baseTargetRouteOpt] || !exposedRoutes[baseTargetRouteOpt].post === false) {
            router.post(`/:id/${targetRoute}`, auth('CREATE'), (req, res, next) => {
              const attachReply = _attachReply.bind(null, req, res, next);
              const handleError = _handleError.bind(null, next);
              source.findByPk(req.params.id).then(sourceInstance => {
                if (!sourceInstance) return _createErrorPromise(404, 'source not found.');
                return sourceInstance[association.accessors.create](target.removeIllegalAttributes(req.body));
              }).then(instance => {
                return attachReply(201, instance.get({plain: true}));
              }).catch(err => {
                return handleError(err);
              });
            });
            if (!openApiDocument.paths[baseTargetPath].get) {
              openApiDocument.paths[baseTargetPath].post = openApiHelper.createHasManyOrBelongsToManyPathSpecfication('post', target, targetRoute);
            }
          }

          if (!exposedRoutes[instanceTargetRouteOpt] || !exposedRoutes[instanceTargetRouteOpt].put === false) {
            router.put(`/:id/${targetRoute}/:targetId`, auth('UPDATE'), (req, res, next) => {
              _updateRelation(source, target, association, req, res, next, req.params.id, req.params.targetId,
                (body) => {
                  return target.fillMissingUpdateableAttributes(association, source, target.removeIllegalAttributes(body));
                });
            });
            if (!openApiDocument.paths[instanceTargetPath]) {
              openApiDocument.paths[instanceTargetPath].put = openApiHelper
                .createHasManyOrBelongsToManyInstancePathSpecfication('put', target, targetRoute);
            }
          }

          if (!exposedRoutes[instanceTargetRouteOpt] || !exposedRoutes[instanceTargetRouteOpt].patch === false) {
            router.patch(`/:id/${targetRoute}/:targetId`, auth('UPDATE_PARTIAL'), (req, res, next) => {
              _updateRelation(source, target, association, req, res, next, req.params.id, req.params.targetId,
                (body) => {
                  return target.removeIllegalAttributes(body);
                });
            });
            if (!openApiDocument.paths[instanceTargetPath]) {
              openApiDocument.paths[instanceTargetPath].patch = openApiHelper
                .createHasManyOrBelongsToManyInstancePathSpecfication('patch', target, targetRoute);
            }
          }

          if (!exposedRoutes[baseTargetRouteOpt] || !exposedRoutes[baseTargetRouteOpt].delete === false) {
            router.delete(`/:id/${targetRoute}`, auth('DELETE'), (req, res, next) => {
              unlinkRelations(req, res, next, association.accessors.set);
            });
            if (!openApiDocument.paths[baseTargetPath].delete) {
              openApiDocument.paths[baseTargetPath].delete = openApiHelper
                .createHasManyOrBelongsToManyPathSpecfication('delete', target, targetRoute);
            }
          }

          if (!exposedRoutes[instanceTargetRouteOpt] || !exposedRoutes[instanceTargetRouteOpt].delete === false) {
            router.delete(`/:id/${targetRoute}/:targetId`, auth('DELETE'), (req, res, next) => {
              const attachReply = _attachReply.bind(null, req, res, next);
              const handleError = _handleError.bind(null, next);

              source.findByPk(req.params.id).then(sourceInstance => {
                if (!sourceInstance) return _createErrorPromise(404, 'source not found.');
                return sourceInstance[association.accessors.get]({where: {id: req.params.targetId}}).then(targetInstances => {
                  const targetInstance = targetInstances[0];
                  if (!targetInstance) return _createErrorPromise(404, 'target not found.');
                  return sourceInstance[association.accessors.remove](targetInstance);
                }).then(() => {
                  return attachReply(204);
                });
              }).catch(err => {
                return handleError(err);
              });
            });
            if (!openApiDocument.paths[instanceTargetPath]) {
              openApiDocument.paths[instanceTargetPath].delete = openApiHelper
                .createHasManyOrBelongsToManyInstancePathSpecfication('delete', target, targetRoute);
            }
          }
          break;
      }
    });
  });
  return routingInformation.map(routing => {
    return {route: '/' + routing.route, router: routing.router};
  });
};
