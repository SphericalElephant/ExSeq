'use strict';

module.exports = (sequelize, DataTypes) => {
    const TestModel = sequelize.define('TestModel', {
        value1: {
            type: DataTypes.STRING
        },
        value2: {
            type: DataTypes.INTEGER,
            validate: { min: 0, max: 100 }
        },
    });
    return TestModel;
};