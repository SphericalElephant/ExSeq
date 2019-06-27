'use strict';

const TYPE_MAP = {
  /** integer data types */
  TINYINT: {type: 'integer', format: 'int32'},
  SMALLINT: {type: 'integer', format: 'int32'},
  MEDIUMINT: {type: 'integer', format: 'int32'},
  INTEGER: {type: 'integer', format: 'int32'},
  BIGINT: {type: 'integer', format: 'int64'},

  /** float data types */
  FLOAT: {type: 'number', format: 'float'},
  REAL: {type: 'number', format: 'double'},

  /** double data types */
  DECIMAL: {type: 'number', format: 'double'},
  DOUBLE: {type: 'number', format: 'double'},

  /** stringish data types */
  STRING: {type: 'string'},
  CHAR: {type: 'string'},
  TEXT: {type: 'string'},
  UUID: {type: 'string', format: 'uuid'},
  UUIDV1: {type: 'string', format: 'uuid', description: 'UUID v1'},
  UUIDV4: {type: 'string', format: 'uuid', description: 'UUID v4'},
  ENUM: {type: 'string', description: 'enum'},
  /** date types */
  TIME: {type: 'string'},
  DATEONLY: {type: 'string', format: 'date'},
  DATE: {type: 'string', format: 'date-time'},

  /** binary data types */
  BLOB: {type: 'string', format: 'binary'},

  BOOLEAN: {type: 'boolean'}
};

const convertModel = (model) => {
  if (!model) throw new Error('no model specified!');

  const result = {
    type: 'object',
    required: [],
    properties: {
    }
  };

  const attributes = model.getAttributes();
  for (const attribute in model.getAttributes()) {
    const definition = attributes[attribute];
    if (definition.type.constructor.name === 'VIRTUAL') {
      if (!definition.type.returnType) {
        throw new Error('VIRTUAL field must have a return type!');
      }
    }
    const typeName = definition.type.constructor.name === 'VIRTUAL' ?
      definition.type.returnType : definition.type.constructor.name;
    const dataType = {...TYPE_MAP[typeName]};
    if (!dataType) throw new Error(`unsupported data type ${definition.type}`);
    result.properties[attribute] = dataType;
    if (definition.allowNull === false) result.required.push(attribute);
    if (definition.type.constructor.name === 'VIRTUAL') {
      result.properties[attribute].description = 'this is a VIRTUAL field';
    }
  }
  // We used to put relations in schema.additionalProperties instead of schema.properties but this seems to be invalid
  // according to the schema https://github.com/OAI/OpenAPI-Specification/blob/master/schemas/v3.0/schema.json
  for (const associationName in model.associations) {
    const association = model.associations[associationName];
    const reference = {$ref: `#/components/schemas/${association.target.name}`};
    if (association.associationType === 'HasOne' || association.associationType === 'BelongsTo') {
      const attribute = typeof association.as === 'string' ? association.as : association.as.singular;
      result.properties[attribute] = reference;
    } else {
      const attribute = typeof association.as === 'string' ? association.as : association.as.plural;
      result.properties[attribute] = {type: 'array', items: reference};
    }
  }
  return result;
};

module.exports = {
  convertModel,
  TYPE_MAP
};
