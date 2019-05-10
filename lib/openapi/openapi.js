'use strict';

const semverRegex = require('semver-regex');
const mime = require('mime-types');
const Joi = require('joi')
  .extend((joi) => {
    return {
      base: joi.string(),
      name: 'string',
      language: {
        mimetype: 'must be a valid mime type'
      },
      pre(value, state, options) {
        return value;
      },
      rules: [
        {
          name: 'mimetype',
          params: {
            mimetypes: joi.array()
          },
          setup(params) {
            this._flags.mimetype = true;
          },
          validate(params, value, state, options) {
            console.log('VALIDATE!!!');
            if (params.mimetypes) {
              for (let i = 0; i < params.mimetypes.length; i++) {
                const mimetype = params.mimetypes[i];
                if (!mime.extension(mimetype)) {
                  return this.createError('string.mimetype', {v: value, params: params.mimetypes}, state, options);
                }
                if (value !== mimetype) {
                  return this.createError('string.mimetype', {v: value}, state, options);
                }
              }
            }
            if (!mime.extension(value)) {
              return this.createError('string.mimetype', {v: value}, state, options);
            }
            return value;
          }
        }
      ]
    };
  });

const _allMimetypes = Object.values(mime.types);

const _url = Joi.string().uri({scheme: ['http', 'https']});

const specificationExtensionObject = (schema) => {
  return Joi.object(schema).pattern(/(x-)\w+/, Joi.any());
};

const _reference = Joi.object({
  $ref: Joi.string().required()
});

// The discriminator object is legal only when using one of the composite keywords oneOf, anyOf, allOf.
const _discriminator = Joi.object({
  propertyName: Joi.string().required(),
  mapping: Joi.object().pattern(/^\w+$/, Joi.string())
});

const _externalDocs = specificationExtensionObject({
  description: Joi.string(),
  url: _url.required()
});

const _xml = specificationExtensionObject({
  name: Joi.string(),
  namespace: _url,
  prefix: Joi.string(),
  attribute: Joi.boolean(),
  wrapped: Joi.boolean()
});

const _schema = specificationExtensionObject({
  title: Joi.string(),
  multipleOf: Joi.number().min(1),
  maximum: Joi.number()
    .when('minimum', {is: Joi.exist(), then: Joi.number().greater(Joi.ref('minimum'))}),
  exclusiveMaximum: Joi.boolean(),
  minimum: Joi.number(),
  exclusiveMinimum: Joi.boolean(),
  maxLength: Joi.number().integer().min(0)
    .when('minLength', {is: Joi.exist(), then: Joi.number().greater(Joi.ref('minLength'))}),
  minLength: Joi.number().integer().min(0),
  pattern: Joi.string(), // TODO: must be a regex
  maxItems: Joi.number().integer().min(0)
    .when('minItems', {is: Joi.exist(), then: Joi.number().greater(Joi.ref('minItems'))}),
  minItems: Joi.number().integer().min(0),
  uniqueItems: Joi.boolean(),
  maxProperties: Joi.number().integer().min(0)
    .when('minProperties', {is: Joi.exist(), then: Joi.number().greater(Joi.ref('minProperties'))}),
  minProperties: Joi.number().integer().min(0),
  required: Joi.array().unique().items(Joi.string()),
  enum: Joi.array().unique(),
  type: Joi.string(),
  allOf: Joi.array().items(_reference, Joi.lazy(() => _schema)),
  oneOf: Joi.array().items(_reference, Joi.lazy(() => _schema)),
  anyOf: Joi.array().items(_reference, Joi.lazy(() => _schema)),
  not: Joi.alternatives(_reference, Joi.lazy(() => _schema)),
  items: Joi.alternatives(_reference, Joi.lazy(() => _schema))
    .when('type', {is: 'array', then: Joi.required()}),
  properties: Joi.lazy(() => _schema),
  additionalProperties: Joi.alternatives(Joi.boolean(), Joi.lazy(() => _schema)),
  description: Joi.string(),
  format: Joi.string(),
  // .when('type', {is: 'integer', then: Joi.valid('int32', 'int64')})
  // .when('type', {is: 'number', then: Joi.valid('float', 'double')})
  // .when('type', {is: 'string', then: Joi.valid(
  //   'byte', 'binary', 'date', 'date-time', 'email', 'hostname', 'ipv4', 'ipv6', 'password', 'uri', 'uriref', 'uuid'
  // )}),
  default: Joi.any() // TODO: format validation
    .when('type', {is: 'integer', then: Joi.number().integer()})
    .when('type', {is: 'number', then: Joi.number()})
    .when('type', {is: 'string', then: Joi.string()})
    .when('type', {is: 'boolean', then: Joi.boolean()})
    .when('type', {is: 'array', then: Joi.array()})
    .when('type', {is: 'object', then: Joi.object()}),
  nullable: Joi.boolean(),
  discriminator: _discriminator,
  readOnly: Joi.boolean(),
  writeOnly: Joi.boolean(),
  xml: _xml,
  externalDocs: _externalDocs,
  example: Joi.any(),
  deprecated: Joi.boolean()
}).with('allOf', 'discriminator')
  .with('anyOf', 'discriminator')
  .with('oneOf', 'discriminator');

const _server = specificationExtensionObject({
  url: _url,
  description: Joi.string(),
  variables: Joi.object().pattern(/^\w+$/, specificationExtensionObject({
    enum: Joi.array().items(Joi.string()),
    default: Joi.string().required(),
    description: Joi.string()
  }))
});

const _tag = specificationExtensionObject({
  name: Joi.string().required(),
  description: Joi.string(),
  externalDocs: _externalDocs
});

const _example = specificationExtensionObject({
  summary: Joi.string(),
  description: Joi.string(),
  value: Joi.any(),
  externalValue: Joi.string()
});

// TODO: implement rule validation - https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.1.md#parameterObject
const _parameter = specificationExtensionObject({
  name: Joi.string().required(), // rules...
  in: Joi.string().required().valid(['query', 'header', 'path', 'cookie']),
  description: Joi.string(),
  required: Joi.boolean()
    .when('in', {is: 'path', then: Joi.required().valid(true)}),
  deprecated: Joi.boolean(),
  allowEmptyValue: Joi.boolean().when('in', {is: 'query', otherwise: Joi.valid()}),
  style: Joi.string()
    .when('in', {is: 'path', then: Joi.valid('matrix', 'label', 'simple')})
    .when('in', {is: 'query', then: Joi.valid('form', 'spaceDelimited', 'pipeDelimited', 'deepObject')})
    .when('in', {is: 'cookie', then: Joi.valid('form')})
    .when('in', {is: 'header', then: Joi.valid('simple')}),
  explode: Joi.boolean(),
  allowReserved: Joi.boolean()
    .when('in', {is: 'query', otherwise: Joi.valid()}),
  schema: Joi.alternatives([_schema, _reference]),
  example: Joi.any(),
  examples: Joi.object().pattern(/^\w+$/, Joi.alternatives(_example, _reference, Joi.string())),
  content: Joi.object().pattern(/^\w+$/, Joi.lazy(() => _mediaType)).min(1).max(1)
}).xor(['schema', 'content']);

const _header = specificationExtensionObject({
  name: Joi.any(),
  in: Joi.any(),
  description: Joi.string(),
  required: Joi.boolean(),
  deprecated: Joi.boolean(),
  style: Joi.string().valid('simple'),
  explode: Joi.boolean(),
  schema: Joi.alternatives([_schema, _reference]),
  example: Joi.any(),
  examples: Joi.array().items(_example, _reference, Joi.string()),
  content: Joi.object().pattern(/^\w+$/, Joi.lazy(() => _mediaType)).min(1).max(1)
}).forbiddenKeys('name', 'in').xor(['schema', 'content']);

// TODO: check if security schema exists!
// TODO: check if security schema is of type "oauth2" or "openIdConnect" AND array is empty!
const _security = Joi.object().pattern(/^\w+$/, Joi.array().items(Joi.string()));

const _response = specificationExtensionObject({
  description: Joi.string().required(),
  headers: Joi.object().pattern(/^\w+$/, Joi.alternatives([_header, _reference])),
  content: Joi.object().pattern(/^\w+$/, Joi.lazy(() => _mediaType)),
  links: Joi.object().pattern(/^\w+$/, Joi.alternatives([Joi.lazy(() => _link), _reference]))
});

const _responses = Joi.object().pattern(/^\w+$/, Joi.alternatives([_response, _reference]));

const _encoding = specificationExtensionObject({
  contentType: Joi.string().mimetype(),
  headers: Joi.object().pattern(/^\w+$/, Joi.alternatives([_header, _reference])),
  style: Joi.string().valid('form', 'spaceDelimited', 'pipeDelimited', 'deepObject'),
  explode: Joi.boolean(),
  allowReserved: Joi.boolean()
});

const _mediaType = specificationExtensionObject({
  schema: Joi.alternatives([_schema, _reference]),
  example: Joi.any(),
  examples: Joi.object().pattern(/^\w+$/, Joi.alternatives(_example, _reference)),
  encoding: Joi.object().pattern(/^\w+$/, _encoding)
});

const _requestBody = specificationExtensionObject({
  description: Joi.string(),
  content: Joi.object().pattern(/^\w+$/, _mediaType).required(),
  required: Joi.boolean()
});

const _callback = Joi.object().pattern(/^\w+$/, Joi.lazy(() => _pathItem));

// TODO: "Specification Extensions"
const _operation = specificationExtensionObject({
  tags: Joi.array().items(Joi.string()),
  summary: Joi.string(),
  description: Joi.string(),
  externalDocs: _externalDocs,
  operationId: Joi.string(), // TODO: must be unique within all pathItems
  parameters: Joi.array().items([_parameter, _reference])
    .unique((a, b) => {
      if (typeof a === typeof b) {
        if (typeof a === 'object') {
          return a.name === b.name && a.location === b.location;
        }
        return a.$ref === b.$ref;
      }
      return false;
    }),
  requestBody: Joi.alternatives([_requestBody, _reference]),
  responses: _responses.required(),
  callbacks: Joi.object().pattern(/^\w+$/, Joi.alternatives([_callback, _reference])),
  deprecated: Joi.boolean(),
  security: Joi.array().items(_security),
  servers: Joi.array().items(_server)
});

const _pathItem = specificationExtensionObject({
  $ref: Joi.string(), // TODO: check if referenced path exists!
  summary: Joi.string(),
  description: Joi.string(),
  get: _operation,
  put: _operation,
  post: _operation,
  delete: _operation,
  options: _operation,
  head: _operation,
  patch: _operation,
  trace: _operation,
  servers: Joi.array().items(_server),
  parameters: Joi.array().items(_parameter, _reference)
});

const _securityScheme = specificationExtensionObject({
  type: Joi.string().required().valid(['apiKey', 'http', 'oauth2', 'openIdConnect']),
  description: Joi.string(),
  name: Joi.string().when('type', {is: 'apiKey', then: Joi.required()}),
  in: Joi.string().valid(['query', 'header', 'cookie']).when('type', {is: 'apiKey', then: Joi.required()}),
  scheme: Joi.string().valid(['basic', 'bearer']).when('type', {is: 'http', then: Joi.required()}),
  bearerFormat: Joi.string(), // applies only to "type": "http" & "scheme": "bearer",
  flows: specificationExtensionObject({
    implicit: specificationExtensionObject({
      authorizationUrl: _url.required(),
      tokenUrl: _url,
      refreshUrl: _url,
      scopes: Joi.object().pattern(/^\w+$/, Joi.string()).required()
    }),
    password: specificationExtensionObject({
      authorizationUrl: _url,
      tokenUrl: _url.required(),
      refreshUrl: _url,
      scopes: Joi.object().pattern(/^\w+$/, Joi.string()).required()
    }),
    clientCredentials: specificationExtensionObject({
      authorizationUrl: _url,
      tokenUrl: _url.required(),
      refreshUrl: _url,
      scopes: Joi.object().pattern(/^\w+$/, Joi.string()).required()
    }),
    authorizationCode: specificationExtensionObject({
      authorizationUrl: _url.required(),
      tokenUrl: _url.required(),
      refreshUrl: _url,
      scopes: Joi.object().pattern(/^\w+$/, Joi.string()).required()
    })
  }).when('type', {is: 'oauth2', then: Joi.required()}),
  openIdConnectUrl: _url.when('type', {is: 'openIdConnect', then: Joi.required()})
});

const _link = specificationExtensionObject({
  operationRef: Joi.string(), // TODO: check if referenced Operation exsists
  operationId: Joi.string(), // TODO: check if referenced Operation exists
  parameters: Joi.object().pattern(/^\w+$/, Joi.any()), // validate parameter location (i.e. the key)
  requestBody: Joi.any(),
  description: Joi.string(),
  server: _server
}).xor('operationRef', 'operationId');

const _openapi = Joi.object().keys({
  openapi: Joi.string().regex(semverRegex()).required(),
  info: Joi.object({
    title: Joi.string().required(),
    description: Joi.string(),
    termsOfService: _url,
    contact: Joi.object({
      name: Joi.string(),
      url: _url,
      email: Joi.string().email()
    }),
    license: Joi.object({
      name: Joi.string().required(),
      url: _url
    }),
    version: Joi.string().required()
  }).required(),
  servers: Joi.array().items(_server),
  paths: Joi.object().pattern(/^\/\w+$/, _pathItem).required(),
  components: specificationExtensionObject({
    schemas: Joi.object().pattern(/^\/\w+$/, Joi.alternatives(_schema, _reference, Joi.string())),
    responses: Joi.object().pattern(/^\/\w+$/, Joi.alternatives(_response, _reference, Joi.string())),
    parameters: Joi.object().pattern(/^\/\w+$/, Joi.alternatives(_parameter, _reference, Joi.string())),
    examples: Joi.object().pattern(/^\/\w+$/, Joi.alternatives(_example, _reference, Joi.string())),
    requestBodies: Joi.object().pattern(/^\/\w+$/, Joi.alternatives(_requestBody, _reference, Joi.string())),
    headers: Joi.object().pattern(/^\/\w+$/, Joi.alternatives(_header, _reference, Joi.string())),
    securitySchemes: Joi.object().pattern(/^\/\w+$/, Joi.alternatives(_securityScheme, _reference, Joi.string())),
    links: Joi.object().pattern(/^\/\w+$/, Joi.alternatives(_link, _reference, Joi.string())),
    callbacks: Joi.object().pattern(/^\/\w+$/, Joi.alternatives(_callback, _reference, Joi.string()))
  }),
  security: Joi.array().items(_security),
  tags: Joi.array().items(_tag),
  externalDocs: _externalDocs
});

module.exports = (spec) => {
  const result = Joi.validate(spec, _openapi);
  console.log(result.error);
  return result.error === null;
};
