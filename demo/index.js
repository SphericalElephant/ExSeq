'use strict';

const exseq = require('../index');
const Sequelize = require('sequelize4');
const {Model} = Sequelize;
const express = require('express');
const swaggerUi = require('swagger-ui-express');

const app = express();
const sequelize = new Sequelize('', '', '', {storage: ':memory:', dialect: 'sqlite', logging: false});

class Car extends Model {}
Car.init({
  make: Sequelize.STRING,
  horsePowers: Sequelize.INTEGER,
  weight: Sequelize.INTEGER
}, {sequelize, modelName: 'car'});

class Tire extends Model {}
Tire.init({
  make: Sequelize.STRING
}, {sequelize, modelName: 'tire'});

Car.hasMany(Tire);

const apiData = exseq([
  {model: Car, opts: {}}
  {model: Tire, opts: {}}
], {
  dataMapper: Sequelize,
  idRegex: '\\d+'
});

apiData.routingInformation.forEach((routing) => {
  app.use(routing.route, routing.router);
});
const openApiDocument = apiData.exspec;

app.get('/swagger.json', (req, res, next) => {
  res.status(200).send(openApiDocument);
});

app.use('/swagger-ui', swaggerUi.serve);
app.get('/swagger-ui', swaggerUi.setup(openApiDocument, false, {docExpansion: 'none'}));

app.listen(3000, () => {
  console.log('started server on port 3000');
});
