'use strict';

module.exports = (sequelize, DataTypes) => {
  const TestModelVirtualType = sequelize.define('TestModelVirtualType', {
    value1: {
      type: DataTypes.STRING,
      allowNull: true
    },
    value2: {
      type: DataTypes.INTEGER,
      validate: {min: 0, max: 100}
    },
    value3: {
      type: DataTypes.VIRTUAL(DataTypes.INTEGER)
    }
  });

  return TestModelVirtualType;
};
