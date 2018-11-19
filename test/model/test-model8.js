'use strict';

module.exports = (sequelize, DataTypes) => {
    return sequelize.define('TestModel8', {
        name: {
            type: DataTypes.STRING
        },
        value: {
            type: DataTypes.STRING
        }
    });
};