'use strict';

module.exports = (sequelize, DataTypes) => {
    const TestModel3 = sequelize.define('TestModel3', {
        value1: {
            type: DataTypes.STRING
        },
        value2: {
            type: DataTypes.INTEGER            
        }
    });
    return TestModel3;
};