'use strict';

const baseSchema = require('./schema.json');
const Ajv = require('ajv');

module.exports = (spec, opts) => {
  const schema = opts.extensions ? {...baseSchema, ...opts.extensions} : baseSchema;
  const ajv = new Ajv({schemaId: 'auto', allErrors: true, verbose: true});
  ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-04.json'));
  const validate = ajv.compile(schema);
  const valid = validate(spec);
  if (!valid) {
    if (opts.errorCallback) {
      opts.errorCallback(validate.errors);
    }
    if (opts.logErrors) {
      const level = opts.logErrors.level || 'log';
      switch (level) {
        case 'info':
          console.info(validate.errors);
          break;
        case 'warn':
          console.warn(validate.errors);
        case 'error':
        case 'exception':
          console.error(validate.errors);
        default:
          console.log(validate.errors);
      }
    }
  }
  return valid;
};
