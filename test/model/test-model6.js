'use strict';

module.exports = (sequelize, DataTypes) => {
    return sequelize.define('TestModel6', {
        name: {
            type: DataTypes.STRING
        }
    });
};