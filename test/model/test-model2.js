'use strict';

module.exports = (sequelize, DataTypes) => {
    const TestModel2 = sequelize.define('TestModel2', {
        value1: {
            type: DataTypes.STRING
        }
    });
    return TestModel2;
};