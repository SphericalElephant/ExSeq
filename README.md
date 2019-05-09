# ExSeq
[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]
[![Build Status](https://travis-ci.com/SphericalElephant/ExSeq.svg?branch=master)](https://travis-ci.com/SphericalElephant/ExSeq)
[![Coverage Status](https://coveralls.io/repos/github/SphericalElephant/ExSeq/badge.svg?branch=master)](https://coveralls.io/github/SphericalElephant/ExSeq?branch=master)

## About
ExSeq uses Sequelize models to generate a REST API using the Express web framework.

## Installation

``` $ npm install @sphericalelephant/exseq```

## Features

* CRUD API generation, including partial updates.
* Unopinionated authorization integration via Express middlewares.
* Supports all association types provided by Sequelize.

## Getting Started

### Creating Routes For Models

```javascript
const exseq = require('exseq');
const express = require('express');
const app = express();
const bodyParser = require('body-parser');

app.use(bodyParser.json({}));

exseq([
  {model: Car, opts: {}},
  {model: Tire, opts: {}},
]).forEach((routing) => {
  app.use(routing.route, routing.router);
});
```

### Options (opts)

|                     Option                      |                                                                                                                                                                                                                                                   Description                                                                                                                                                                                                                                                   |
| :---------------------------------------------: | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: |
|                      route                      |                                                                                                                                                                                                                             Overrides the default label for the first route segment                                                                                                                                                                                                                             |
| authorizeWith.options.useParentForAuthorization | Use the access rules of the *source* entity instead of the *target* entity, when using the *source* entity route to access the *target* entity. This flag is may only be set in the *target* entitiy configuration. Example: A TIRE belongsTo a CAR (or a CAR hasMany TIRES) When using /car/:id/tire/:tireId to access a tire, the user access to CAR is checked to see if the user canaccess a TIRE. This option may only be used in *target* entites that have either a **HasOne** or **BelongsTo** relation |
|   authorizeWith.options.authorizeForChildren    |                                                                                                             Enables the use of the *source* authorization middleware for *target* entites. This setting must be set in the *source* entity. It causes all authorization request to go through the *source* authorization middleware. A *target* must only use a single *source* for authorization!                                                                                                              |
|               authorizeWith.rules               |                                                                                                                                                                                                                                        Contains authorization definition                                                                                                                                                                                                                                        |

#### Examples

Define a custom name for a *source*:
```javascript
const exseq = require('exseq');
exseq([
  {model: Person, opts: {route: 'User'}}
]).forEach((routing) => {
  app.use(routing.route, routing.router);
});
```

Authorization rules:
```javascript
const exseq = require('exseq');
const isEntityOwner = (req, res, next) => {
  // handle authorization here
};
const isUser = (req, res, next) => {
  // handle authorization here
}
const deny = (req, res, next) => {
  const err = new Error();
  err.status = 401;
  return next(err);
}
exseq([
  {
    model: Car, opts: {
      authorizeWith: {
        rules: {
          CREATE: isUser,
          READ: isEntityOwner,
          UPDATE: isEntityOwner,
          UPDATE_PARTIAL: isEntityOwner,
          DELETE: deny,
          SEARCH: isUser,
          // OTHER can be used to handle all cases that
          // have not been explicitly handled by any other
          // rule.
          // OTHER: deny
        }
      }
    }
  }
]).forEach((routing) => {
  app.use(routing.route, routing.router);
});
```

authorizeForChildren - All Tire routes are authorized by the Car rules.
```javascript
const exseq = require('exseq');
exseq([
  {
    model: Car, opts: {
      authorizeWith: {
        rules: {
          READ: isUser,
          OTHER: deny
        },
        options: {
          authorizeForChildren:  [{
            child: Tire,
            authorizeForChild: true
          }]
        }
      }
    }
  },
  {model: Tire, opts: {}}
]).forEach((routing) => {
  app.use(routing.route, routing.router);
});
```

useParentForAuthorization - All Car related Tire routes are authorized by the Car rules.
```javascript
const exseq = require('exseq');
exseq([
  {
    model: Car, opts: {
      authorizeWith: {
        rules: {
          READ: isUser,
          OTHER: deny
        }
      }
    }
  },
  {
    model: Tire, opts: {
      options: {
        useParentForAuthorization: true
      }
    }
  }
]).forEach((routing) => {
  app.use(routing.route, routing.router);
});
```

## Generated Routes

### Source- and Targetmodels
When generating routes, ExSeq differentiates beteen the **source** and the **target** model. The **source** model is the model whose association method is called, the **target** model is the one passed to the association method as a parameter:

```javascript
const SourceModel = require('./source-model');
const TargetModel = require('./target-model');

SourceModel.belongsTo(TargetModel);

// or

SourceModel.hasMany(TargetModel);
```

### Route Structure / Route Table

The label of the first segment of the route is determined by ```source.name``` or by ```opts.route``` if specified. The label of the target model segment is determined by ```association.options.name.singular```, meaning that it will take any aliases into account.

| Method |        Relation         |            Route             |   Permission   |                           Description                           |
| :----: | :---------------------: | :--------------------------: | :------------: | :-------------------------------------------------------------: |
|  GET   |           N/A           |           /source            |      READ      |                Obtain all instances of *source*                 |
|  GET   |           N/A           |        /source/count         |      READ      |           Obtains the count of all *source* entities.           |
|  POST  |           N/A           |           /source            |     CREATE     |                 Create a new *source* instance                  |
|  POST  |           N/A           |        /source/search        |     SEARCH     |                    Search the *source* table                    |
|  GET   |           N/A           |         /source/:id          |      READ      |             Obtain the specified *source* instance              |
|  PUT   |           N/A           |         /source/:id          |     UPDATE     |           Replace all values of the *source* instance           |
| PATCH  |           N/A           |         /source/:id          | UPDATE_PARTIAL |        Replace selected values of the *source* instance         |
| DELETE |           N/A           |         /source/:id          |     DELETE     |             Delete the specified *source* instance              |
|  GET   |   HasOne / BelongsTo    |      /source/:id/target      |      READ      |             Get all *target* instances of *source*              |
|  POST  |   HasOne / BelongsTo    |      /source/:id/target      |     CREATE     |  Create a new *target* instance and associate it with *source*  |
|  PUT   |   HasOne / BelongsTo    |      /source/:id/target      |     UPDATE     |          Replaces all values of the *target* instance           |
| PATCH  |   HasOne / BelongsTo    |      /source/:id/target      | UPDATE_PARTIAL |        Replaces selected values of the *target* instance        |
| DELETE |   HasOne / BelongsTo    |      /source/:id/target      |     DELETE     |                     Remove the association                      |
|  GET   | HasMany / BelongsToMany |      /source/:id/target      |      READ      |      Obtains an array of all associated *target* instances      |
|  GET   | HasMany / BelongsToMany | /source/:id/target/:targetId |      READ      |               Obtains a single *target* instance                |
|  GET   | HasMany / BelongsToMany |   /source/:id/target/count   |      READ      |           Obtains the count of all *target* entities            |
|  POST  | HasMany / BelongsToMany |      /source/:id/target      |     CREATE     |         Creates and associates a new *target* instance          |
|  POST  | HasMany / BelongsToMany |  /source/:id/target/search   |     SEARCH     | Search items in the *target* table that are related to *source* |
|  PUT   | HasMany / BelongsToMany | /source/:id/target/:targetId |     UPDATE     |          Replaces all values of the *target* instance           |
| PATCH  | HasMany / BelongsToMany | /source/:id/target/:targetId | UPDATE_PARTIAL |        Replaces selected values of the *target* instance        |
| DELETE | HasMany / BelongsToMany | /source/:id/target/:targetId |     DELETE     |             Deletes the specified *target* instance             |

### Respose Headers

|           Route           |        Relation         |    Header     |                          Info                          |
| :-----------------------: | :---------------------: | :-----------: | :----------------------------------------------------: |
|      /source/search       | HasMany / BelongsToMany | X-Total-Count | Contains the count of all results for the search query |
| /source/:id/target/search | HasMany / BelongsToMany | X-Total-Count | Contains the count of all results for the search query |

### GET / POST Parameters

|    Method     | Parameter |         Description         |              Type              |              Example              |
| :-----------: | :-------: | :-------------------------: | :----------------------------: | :-------------------------------: |
|      GET      |     a     | Allows attribute filtering  | "\|" separated list of Strings | /source/?a=name\|birthdate\|email |
| POST (search) |     i     | Items per page (pagination) |            Integer             |      ```{"i": 10, "p":2}```       |
| POST (search) |     p     |      Page (pagination)      |            Integer             |      ```{"i": 10, "p":2}```       |
| POST (search) |     f     |        Sort by field        |             String             |        ```{"f": "name"}```        |
| POST (search) |     o     |         Sort order          |         Enum(ASC/DESC)         |  ```{"f": "name", "o":"ASC"}```   |
| POST (search) |     s     |   Sequelize Search Query    |              JSON              |       ```{s: {value: 1}}```       |

### Search

ExSeq supports searching in accordance to [Sequelize Querying](http://docs.sequelizejs.com/manual/tutorial/querying.html). Please make sure to use the backwards compatible operator notation and not the symbol notation, as shown in the example below. Alternatively, you may use the string representation of the symbol.

Backwards compatible:
```json
{
  "value": {
    "$like": "%foo%"
  }
}
```

Symbol string representation:
```json
{
  "value": {
    "like": "%foo%"
  }
}
```

Symbol (will not work due to JSON.stringify "limitations"):
```json
{
  "value": {
    [Op.like]: "%foo%"
  }
}
```

> Note: When using the `include` attribtue to query data, be aware that the associated models can be fetched without explicit authorization.

## Foreign Key Authorization

Starting from 1.3.0, ExSeq features body foreign key support and unopinionated foreign key based authorization. To enable foreign key authorization support instantiate ExSeq as shown below.

```javascript
const exseq = require('exseq');
const express = require('express');
const app = express();
const bodyParser = require('body-parser');

app.use(bodyParser.json({}));

exseq([
  {model: Car, opts: {}},
  {model: Tire, opts: {}},
], {
  middleware: {
    associationMiddleware: {
      fieldName: 'someField'
    }
  }
}).forEach((routing) => {
  app.use(routing.route, routing.router);
});
```

If enabled, the middleware will attach in instance of ```AssociationInformation``` to the ```req``` object, using ```fieldName``` as a key. If ```fieldName``` has not been provided, the default key ```associationInformation``` is used.

You can now use the following code to obtain information about the relationships of a model, either by using the model or a valid foreign key.

```javascript

const authorizationMiddleware = (req, res, next) => {
  const information = req
    .associationInformation
    .getAssociationInformation(req.params.fk);
  // TODO: handle authorization here!
};
```

The information returned by ```getAssociationInformation``` will look as follows.

For hasOne, hasMany and belongsTo:

```javascript
[{
  source: HasManySource,
  target: HasManyTarget,
  associationType: 'HasMany',
  fk: 'HasManySourceId'
}]
```

For belongsToMany:

```javascript
[{
  source: BelongsToManySource,
  target: BelongsToManyTarget,
  associationType: 'BelongsToMany',
  through: BelongsToManyThrough,
  sourceFk: 'BelongsToManySourceId',
  targetFk: 'BelongsToManyTargetId'
}]
```

[npm-image]: https://img.shields.io/npm/v/@sphericalelephant/exseq.svg
[npm-url]: https://npmjs.org/package/@sphericalelephant/exseq
[downloads-image]: https://img.shields.io/npm/dm/@sphericalelephant/exseq.svg
[downloads-url]: https://npmjs.org/package/@sphericalelephant/exseq

## License
[MIT](LICENSE)
