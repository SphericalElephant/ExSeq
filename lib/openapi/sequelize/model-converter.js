'use strict';

const Sequelize = require('sequelize');
const Model = Sequelize.Model;

const TYPE_MAP = {
  /** integer data types */
  [Sequelize.TINYINT.name]: {type: 'integer', format: 'int32'},
  [Sequelize.SMALLINT.name]: {type: 'integer', format: 'int32'},
  [Sequelize.MEDIUMINT.name]: {type: 'integer', format: 'int32'},
  [Sequelize.INTEGER.name]: {type: 'integer', format: 'int32'},
  [Sequelize.BIGINT.name]: {type: 'integer', format: 'int64'},

  /** float data types */
  [Sequelize.FLOAT.name]: {type: 'number', format: 'float'},
  [Sequelize.REAL.name]: {type: 'number', format: 'double'},

  /** double data types */
  [Sequelize.DECIMAL.name]: {type: 'number', format: 'double'},
  [Sequelize.DOUBLE.name]: {type: 'number', format: 'double'},

  /** stringish data types */
  [Sequelize.STRING.name]: {type: 'string'},
  [Sequelize.CHAR.name]: {type: 'string'},
  [Sequelize.TEXT.name]: {type: 'string'},
  [Sequelize.UUID.name]: {type: 'string'},
  [Sequelize.UUIDV1.name]: {type: 'string'},
  [Sequelize.UUIDV4.name]: {type: 'string'},
  [Sequelize.ENUM.name]: {type: 'string'},
  /** date types */
  [Sequelize.TIME.name]: {type: 'string'},
  [Sequelize.DATEONLY.name]: {type: 'string', format: 'date'},
  [Sequelize.DATE.name]: {type: 'string', format: 'date-time'},

  /** binary data types */
  [Sequelize.BLOB.name]: {type: 'string', format: 'binary'},

  [Sequelize.BOOLEAN.name]: {type: 'boolean'}
};

const convertModel = (model) => {
  if (!model) throw new Error('no model specified!');
  if (!(model.prototype instanceof Model)) throw new Error(`${model.name} is not a sequelize Model`);

  const result = {
    type: 'object',
    required: [],
    properties: {
    }
  };

  const attributes = model.attributes;
  for (const attribute in model.attributes) {
    const definition = attributes[attribute];
    if (definition.type.constructor.name === Sequelize.VIRTUAL.name) {
      if (!definition.type.returnType) {
        throw new Error('VIRTUAL field must have a return type!');
      }
    }
    const typeName = definition.type.constructor.name === Sequelize.VIRTUAL.name ?
      definition.type.returnType : definition.type.constructor.name;
    const dataType = {...TYPE_MAP[typeName]};
    if (!dataType) throw new Error(`unsupported data type ${definition.type}`);
    result.properties[attribute] = dataType;
    if (definition.allowNull !== true) result.required.push(attribute);
    if (definition.type.constructor.name === Sequelize.VIRTUAL.name) {
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
