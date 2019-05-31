'use strict';

module.exports = (name, sequelize, DataTypes) => {
  return sequelize.define(name, {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false
    }
  });
};
