'use strict';

module.exports = (name, sequelize, DataTypes) => {
    return sequelize.define(name, {
        name: {
            type: DataTypes.STRING
        },
        value: {
            type: DataTypes.STRING
        }
    });
};