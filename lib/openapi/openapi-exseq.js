'use strict';

const ATTRIBUTE_FILTER_PARAMETER = {
  name: 'a',
  in: 'query',
  description: 'Allows attribute filtering.',
  required: false,
  schema: {
    type: 'string',
    description: '"|" separated list of Strings'
  },
  example: '/person/?a=name|birthdate|email'
};
const QUERY_PARAMETERS = [
  ATTRIBUTE_FILTER_PARAMETER,
  {
    name: 'i',
    in: 'query',
    description: 'Items per page (pagination). See also: parameter "p"',
    required: false,
    schema: {
      type: 'integer',
      description: 'Integer'
    },
    example: {i: 10, p: 2}
  },
  {
    name: 'p',
    in: 'query',
    description: 'Page (pagination). See also: parameter "i"',
    required: false,
    schema: {
      type: 'integer',
      description: 'Integer'
    },
    example: {i: 10, p: 2}
  },
  {
    name: 'f',
    in: 'query',
    description: 'Sort by field',
    required: false,
    schema: {
      type: 'string',
      description: 'String'
    },
    example: {f: 'name'}
  },
  {
    name: 'o',
    in: 'query',
    description: 'Sort order',
    required: false,
    schema: {
      type: 'string',
      description: 'Enum(ASC/DESC)'
    },
    example: {f: 'name', o: 'ASC'}
  },
  {
    name: 's',
    in: 'query',
    description:
      `Sequelize Search Query. ExSeq supports searching in accordance to Sequelize Querying.
      Please make sure to use the backwards compatible operator notation and not the symbol notation.
      Alternatively, you may use the string representation of the symbol.`,
    required: false,
    schema: {
      type: 'object',
      description: 'JSON'
    },
    examples: {
      backwardCompatible: {
        value: {
          value: {
            $like: '%foo%'
          }
        }
      },
      symbolStringRepresentation: {
        value: {
          value: {
            like: '%foo%'
          }
        }
      }
    }
  }
];
const SEARCH_REQUEST_BODY = {
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: {
          a: {
            type: 'string',
            description: '"|" separated list of Strings. Allows attribute filtering.'
          },
          i: {
            type: 'integer',
            description: 'Items per page (pagination)'
          },
          p: {
            type: 'integer',
            description: 'Page (pagination)'
          },
          f: {
            type: 'string',
            description: 'Field name - Sort by field'
          },
          o: {
            type: 'string',
            description: 'Sort order - one of ["ASC", "DESC"]'
          },
          s: {
            type: 'object',
            description: 'Sequelize query',
            example: {
              value: {
                $like: '%foo%'
              }
            }
          }
        }
      }
    }
  }
};
const X_TOTAL_COUNT_SPECIFICATION = {
  description: 'Contains the count of all results for the search query',
  schema: {
    type: 'integer'
  }
};
const EMPTY_RESPONSE = {
  description: 'An empty object',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: {}
      }
    }
  }
};

module.exports = {
  ATTRIBUTE_FILTER_PARAMETER,
  QUERY_PARAMETERS,
  SEARCH_REQUEST_BODY,
  X_TOTAL_COUNT_SPECIFICATION,
  EMPTY_RESPONSE
};
