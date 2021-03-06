'use strict';

const table = {
  eq: Symbol.for('eq'),
  ne: Symbol.for('ne'),
  gte: Symbol.for('gte'),
  gt: Symbol.for('gt'),
  lte: Symbol.for('lte'),
  lt: Symbol.for('lt'),
  not: Symbol.for('not'),
  is: Symbol.for('is'),
  in: Symbol.for('in'),
  notIn: Symbol.for('notIn'),
  like: Symbol.for('like'),
  notLike: Symbol.for('notLike'),
  iLike: Symbol.for('iLike'),
  notILike: Symbol.for('notILike'),
  startsWith: Symbol.for('startsWith'),
  endsWith: Symbol.for('endsWith'),
  substring: Symbol.for('substring'),
  regexp: Symbol.for('regexp'),
  notRegexp: Symbol.for('notRegexp'),
  iRegexp: Symbol.for('iRegexp'),
  notIRegexp: Symbol.for('notIRegexp'),
  between: Symbol.for('between'),
  notBetween: Symbol.for('notBetween'),
  overlap: Symbol.for('overlap'),
  contains: Symbol.for('contains'),
  contained: Symbol.for('contained'),
  adjacent: Symbol.for('adjacent'),
  strictLeft: Symbol.for('strictLeft'),
  strictRight: Symbol.for('strictRight'),
  noExtendRight: Symbol.for('noExtendRight'),
  noExtendLeft: Symbol.for('noExtendLeft'),
  and: Symbol.for('and'),
  or: Symbol.for('or'),
  any: Symbol.for('any'),
  all: Symbol.for('all'),
  values: Symbol.for('values'),
  col: Symbol.for('col'),
  placeholder: Symbol.for('placeholder'),
  join: Symbol.for('join'),
  $eq: Symbol.for('eq'),
  $ne: Symbol.for('ne'),
  $gte: Symbol.for('gte'),
  $gt: Symbol.for('gt'),
  $lte: Symbol.for('lte'),
  $lt: Symbol.for('lt'),
  $not: Symbol.for('not'),
  $is: Symbol.for('is'),
  $in: Symbol.for('in'),
  $notIn: Symbol.for('notIn'),
  $like: Symbol.for('like'),
  $notLike: Symbol.for('notLike'),
  $iLike: Symbol.for('iLike'),
  $notILike: Symbol.for('notILike'),
  $startsWith: Symbol.for('startsWith'),
  $endsWith: Symbol.for('endsWith'),
  $substring: Symbol.for('substring'),
  $regexp: Symbol.for('regexp'),
  $notRegexp: Symbol.for('notRegexp'),
  $iRegexp: Symbol.for('iRegexp'),
  $notIRegexp: Symbol.for('notIRegexp'),
  $between: Symbol.for('between'),
  $notBetween: Symbol.for('notBetween'),
  $overlap: Symbol.for('overlap'),
  $contains: Symbol.for('contains'),
  $contained: Symbol.for('contained'),
  $adjacent: Symbol.for('adjacent'),
  $strictLeft: Symbol.for('strictLeft'),
  $strictRight: Symbol.for('strictRight'),
  $noExtendRight: Symbol.for('noExtendRight'),
  $noExtendLeft: Symbol.for('noExtendLeft'),
  $and: Symbol.for('and'),
  $or: Symbol.for('or'),
  $any: Symbol.for('any'),
  $all: Symbol.for('all'),
  $values: Symbol.for('values'),
  $col: Symbol.for('col'),
  $placeholder: Symbol.for('placeholder'),
  $join: Symbol.for('join')
};

function replace(obj) {
  for (const k in obj) {
    let shouldDelete = false;
    if (table[k]) {
      obj[table[k]] = obj[k];
      shouldDelete = true;
    }
    if (Array.isArray(obj[k])) {
      for (const i of obj[k]) {
        replace(i);
      }
    } else if (typeof obj[k] === 'object' && obj[k] !== null) {
      replace(obj[k]);
    }
    if (shouldDelete) {
      delete obj[k];
    }
  }
  return obj;
}

function checkAllowed(result, definition, obj) {
  if (!definition) return result;
  for (const k in obj) {
    if (table[k]) {
      const isAllowed = definition[k] === true || definition[`$${k}`] === true || definition[k.replace(/\$/gi, '')] === true;
      if (!isAllowed) {
        result.success = false;
        if (result.operators.indexOf(k) === -1)
          result.operators.push(k);
      }
    }
    if (Array.isArray(obj[k])) {
      for (const i of obj[k]) {
        checkAllowed(result, definition, i);
      }
    } else if (typeof obj[k] === 'object' && obj[k] !== null) {
      checkAllowed(result, definition, obj[k]);
    }
  }
  return result;
}

function get(operator) {
  if (!exists(operator)) return null;
  return Symbol.for(this[operator]);
}

function exists(operator) {
  return !!this[operator];
}

module.exports = {
  ...table,
  replace,
  checkAllowed: (definition, obj) => {
    return checkAllowed({success: true, operators: []}, definition, obj);
  },
  get: get.bind(table),
  exists: exists.bind(table)
};
