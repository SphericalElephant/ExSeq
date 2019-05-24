'use strict';

const PARAMETERS = {
  exseqAttributeFilter: {
    name: 'a',
    in: 'query',
    description: 'Allows attribute filtering.',
    required: false,
    schema: {
      type: 'string',
      description: '"|" separated list of Strings'
    },
    example: '/person/?a=name|birthdate|email'
  },
  exseqItems: {
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
  exseqPage: {
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
  exseqField: {
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
  exseqOrder: {
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
  exseqSearch: {
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
};
const PARAMETER_REFS = Object.keys(PARAMETERS).reduce((refs, p) => {
  refs[p] = {$ref: `#/components/parameters/${p}`};
  return refs;
}, {});

const SCHEMAS = {
  exseqSearch: {
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
  },
  exseqCountResponse: {
    type: 'object',
    properties: {
      status: {
        type: 'integer'
      },
      message: {
        type: 'string'
      },
      payload: {
        type: 'integer'
      }
    }
  },
  exseqEmptyResponse: {
    type: 'object',
    properties: {
      status: {
        type: 'integer'
      },
      message: {
        type: 'string'
      },
      payload: {
        type: 'string'
      }
    }
  }
};
const SCHEMA_REFS = Object.keys(SCHEMAS).reduce((refs, s) => {
  refs[s] = {$ref: `#/components/schemas/${s}`};
  return refs;
}, {});

const REQUEST_BODIES = {
  exseqSearch: {
    content: {
      'application/json': {
        schema: SCHEMA_REFS.exseqSearch
      }
    },
    required: true
  }
};
const REQUEST_BODY_REFS = Object.keys(REQUEST_BODIES).reduce((refs, r) => {
  refs[r] = {$ref: `#/components/requestBodies/${r}`};
  return refs;
}, {});

const RESPONSES = {
  exseqCount: {
    description: 'The count for this query.',
    content: {
      'application/json': {
        schema: {
          $ref: '#/components/schemas/exseqCountResponse'
        }
      }
    }
  },
  exseqEmpty: {
    description: 'An empty object',
    content: {
      'application/json': {
        schema: {
          $ref: '#/components/schemas/exseqEmptyResponse'
        }
      }
    }
  },
  exseqInvalidInput: {description: 'Illegal input for operation.'},
  exseqUnauthorized: {description: 'Unauthorized.'},
  exseqNotFound: {description: 'Not found.'},
  exseqUnexpectedError: {description: 'Unexpected Error.'}
};
const RESPONSE_REFS = Object.keys(RESPONSES).reduce((refs, r) => {
  refs[r] = {$ref: `#/components/responses/${r}`};
  return refs;
}, {});

const HEADERS = {
  exseqXTotalCount: {
    description: 'Contains the count of all results for the search query',
    schema: {
      type: 'integer'
    }
  }
};
const HEADER_REFS = Object.keys(HEADERS).reduce((refs, h) => {
  refs[h] = {$ref: `#/components/headers/${h}`};
  return refs;
}, {});

module.exports = {
  EXSEQ_COMPONENTS: {
    headers: HEADERS,
    parameters: PARAMETERS,
    requestBodies: REQUEST_BODIES,
    responses: RESPONSES,
    schemas: SCHEMAS
  },
  HEADER_REFS,
  PARAMETER_REFS,
  REQUEST_BODY_REFS,
  RESPONSE_REFS,
  SCHEMA_REFS
};
