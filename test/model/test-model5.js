'use strict';

module.exports = (sequelize, DataTypes) => {
    return sequelize.define('TestModel5', {
        name: {
            type: DataTypes.STRING
        },
        value: {
            type: DataTypes.STRING
        }
    });
};