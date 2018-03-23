'use strict';

const Sequelize = require('sequelize');
const Model = Sequelize.Model;

const TYPE_MAP = {
    /** integer data types */
    [Sequelize.TINYINT.name]: {type: 'integer', format: 'int32', cname: 'integer'},
    [Sequelize.SMALLINT.name]: {type: 'integer', format: 'int32', cname: 'integer'},
    [Sequelize.MEDIUMINT.name]: {type: 'integer', format: 'int32', cname: 'integer'},
    [Sequelize.INTEGER.name]: {type: 'integer', format: 'int32', cname: 'integer'},
    [Sequelize.BIGINT.name]: {type: 'integer', format: 'int64', cname: 'long'},

    /** float data types */
    [Sequelize.FLOAT.name]: {type: 'number', format: 'float', cname: 'floag'},
    [Sequelize.REAL.name]: {type: 'number', format: 'double', cname: 'double'},

    /** double data types */
    [Sequelize.DECIMAL.name]: {type: 'number', format: 'double', cname: 'double'},
    [Sequelize.DOUBLE.name]: {type: 'number', format: 'double', cname: 'double'},

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
    [Sequelize.DATEONLY.name]: {type: 'string', format: 'date', cname: 'date'},
    [Sequelize.DATE.name]: {type: 'string', format: 'date-time', cname: 'dateTime'},

    /** binary data types */
    [Sequelize.BLOB.name]: {type: 'string', format: 'binary', cname: 'binary'},

    [Sequelize.BOOLEAN.name]: {type: 'boolean'}
}

module.exports = (model) => {
    if (!model) throw new Error('no model specified!');
    if (!(model.prototype instanceof Model)) throw new Error(`${model.name} is not a sequelize Model`);

    const result = {
        type: 'object',
        required: [],
        properties: {
        }
    };

    const attributes = model.attributes;
    for (let attribute in model.attributes) {
        const definition = attributes[attribute];
        const dataType = TYPE_MAP[definition.type.constructor.name];
        if (!dataType) throw new Error(`unsupported data type ${definition.type}`);
        result.properties[attribute] = {
            type: dataType
        };
        if (definition.allowNull !== true) result.required.push(attribute);
    }
    return result;
};