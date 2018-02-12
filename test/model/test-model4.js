'use strict';

module.exports = (sequelize, DataTypes) => {
    return sequelize.define('TestModel4', {
        name: {
            type: DataTypes.STRING
        }
    });
};