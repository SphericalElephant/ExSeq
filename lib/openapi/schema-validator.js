'use strict';

const baseSchema = require('./schema.json');
const Ajv = require('ajv');

module.exports = (spec, extensions) => {
  const schema = extensions ? {...baseSchema, ...extensions} : baseSchema;
  const ajv = new Ajv({schemaId: 'auto', allErrors: true, verbose: true});
  ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-04.json'));
  const validate = ajv.compile(schema);
  const valid = validate(spec);
  if (!valid) {
    console.log(validate.errors);
  }
  return valid;
};
