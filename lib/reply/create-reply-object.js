'use strict';

module.exports = (raw, object) => {
  let objects;
  let inputWasArray = false;
  if (Array.isArray(object)) {
    inputWasArray = true;
    objects = object;
  } else {
    objects = [object];
  }
  const result = objects.map(o => {
    if (raw) {
      if (!o.get || !(o.get instanceof Function)) return o;
      return o.get({plain: true});
    } else {
      return o;
    }
  });
  if (!inputWasArray) return result[0];
  else return result;
};
