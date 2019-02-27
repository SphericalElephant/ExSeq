'use strict';

const validator = require('validator');
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
            console.log('VALIDATE!!!')
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
const _style = Joi.valid('form', 'simple');

// TODO
const _schema = Joi.object().keys({

});

const _server = Joi.object().keys({
  url: _url,
  description: Joi.string(),
  variables: Joi.object().pattern(/^\w+$/, Joi.object().keys({
    enum: Joi.array().items(Joi.string()),
    default: Joi.string().required(),
    description: Joi.string()
  }))
});

const _externalDocs = Joi.object().keys({
  description: Joi.string(),
  url: _url.required()
});

const _reference = Joi.object().keys({
  $ref: Joi.string().required()
});

const _example = Joi.object().keys({
  summary: Joi.string(),
  description: Joi.string(),
  value: Joi.any(),
  externalValue: Joi.string()
});

// TODO: implement rule validation - https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.1.md#parameterObject
// TODO: finish
const _parameter = Joi.object().keys({
  name: Joi.string().required(),
  in: Joi.string().required(),
  description: Joi.string(),
  required: Joi.boolean().required(),
  deprecated: Joi.boolean(),
  allowEmptyValue: Joi.boolean(),
  style: _style,
  explode: Joi.boolean(),
  allowReserved: Joi.boolean(),
  schema: Joi.alternatives([_schema, _reference]),
  example: Joi.any(),
  examples: Joi.array().items(_example, _reference)
});

// TODO!
const _header = Joi.object().keys({

});

// TODO!
const _callback = Joi.object().keys({

});

// TODO! implement check that security schema exists!
const _security = Joi.object().pattern(/^\w+$/, Joi.array().items(Joi.string()));

const _response = Joi.object().keys({
  description: Joi.string(),
  headers: Joi.object()
    .pattern(/^\w+$/, Joi.alternatives([_header, _reference]))
});

const _responses = Joi.object().pattern(/^\w+$/, Joi.alternatives([_response, _reference]));

const _encoding = Joi.object().keys({
  contentType: Joi.string().mimetype(),
  headers: Joi.alternatives([_header, _reference]),
  style: _style,
  explode: Joi.boolean(),
  allowReserved: Joi.boolean()
})

const _mediaType = Joi.object().keys({
  schema: Joi.alternatives([_schema, _reference]),
  example: Joi.any(),
  examples: Joi.object().pattern(/^\w+$/, Joi.alternatives(_example, _reference)),
  encoding: Joi.object().pattern(/^\w+$/, _encoding)
});

const _requestBody = Joi.object().keys({
  description: Joi.string(),
  content: Joi.object().pattern(/^\w+$/, _mediaType),
  required: Joi.boolean()
});

// TODO: "Specification Extensions"
const _operation = Joi.object().keys({
  tags: Joi.array().items(Joi.string()),
  summary: Joi.string(),
  description: Joi.string(),
  externalDocs: _externalDocs,
  operationId: Joi.string(),
  parameters: Joi.alternatives([_parameter, _reference]),
  requestBody: Joi.alternatives([_requestBody, _reference]),
  responses: _responses.required(),
  callbacks: Joi.object().pattern(/^\w+$/, Joi.alternatives([_callback, _reference])),
  deprecated: Joi.boolean(),
  security: Joi.array().items(_security),
  servers: Joi.array().items(_server)
});

const _openapi = Joi.object().keys({
  openapi: Joi.string().regex(semverRegex()).required(),
  info: Joi.object().required().keys({
    title: Joi.string().required(),
    description: Joi.string(),
    termsOfService: _url,
    contact: Joi.object().keys({
      name: Joi.string(),
      url: _url,
      email: Joi.string().email()
    }),
    license: Joi.object().keys({
      name: Joi.string().required(),
      url: _url,
    }),
    version: Joi.string().required()
  }),
  servers: Joi.array().items(_server),
  paths: Joi.object().pattern(/^\/\w+$/, Joi.object().keys({
    $ref: Joi.string(),
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
  })),
});

const _openapiDefault = {
  openapi: '3.0.1',
  info: {
    title: 'Placeholder API',
    description: undefined,
    termsOfService: undefined,
    contact: {
      name: undefined,
      url: undefined,
      email: undefined
    },
    license: {
      name: undefined,
      url: undefined
    },
    version: '1.0.0'
  },
  servers: [{
    url: undefined,
    description: undefined,
    variables: {

    }
  }],
  paths: [],
  components: {
    schemas: {

    }
  },
  security: {

  },
  tags: {

  },
  externalDocs: {

  }
};

const _proxyHandler = {
  get: (obj, key) => {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      return new Proxy(obj[key], _proxyHandler)
    } else {
      return obj[key];
    }
  },
  set: (obj, key, value) => {
    if (typeof obj[key] === 'object') {
      throw new Error('You may not overwrite an object directly.');
    }
    return value;
  }
};

module.exports = () => {
  const p = new Proxy(_openapiDefault, _proxyHandler);
  return p;
};
