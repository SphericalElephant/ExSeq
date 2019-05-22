'use strict';

const baseSchema = require('./schema.json');
const Ajv = require('ajv');

const findDuplicateOperationIds = (spec) => {
  const duplicateOperationIds = new Set();
  const operationIds = new Set();
  for (const pathName in spec.paths) {
    for (const operationName in ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']) {
      if (spec.paths[pathName][operationName] && spec.paths[pathName][operationName].operationId) {
        if (operationIds.has(spec.paths[pathName][operationName].operationId)) {
          duplicateOperationIds.add(spec.paths[pathName][operationName].operationId);
        }
        operationIds.add(spec.paths[pathName][operationName].operationId);
      }
    }
  }
  return Array.from(duplicateOperationIds);
};

module.exports = (spec, opts) => {
  const schema = opts.extensions ? {...baseSchema, ...opts.extensions} : baseSchema;
  const ajv = new Ajv({schemaId: 'auto', allErrors: true, verbose: true});
  ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-04.json'));
  const validate = ajv.compile(schema);

  const duplicateOperationIds = findDuplicateOperationIds(spec);
  const valid = validate(spec) && !duplicateOperationIds.length;

  if (!valid) {
    const errors = {...validate.errors};
    if (duplicateOperationIds.length) {
      errors.duplicateOperationIds = {
        message: 'operationId must be unique - you can set each operationId manually via options (openapi.<path>.<operation>.operationId)',
        duplicateIds: duplicateOperationIds
      };
    }
    if (opts.errorCallback) {
      opts.errorCallback(errors);
    }
    if (opts.logErrors) {
      const level = opts.logErrors.level || 'log';
      switch (level) {
        case 'info':
          console.info(errors);
          break;
        case 'warn':
          console.warn(errors);
          break;
        case 'error':
        case 'exception':
          console.error(errors);
          break;
        default:
          console.log(errors);
      }
    }
  }
  return valid;
};
