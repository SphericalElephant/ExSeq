'use strict';

module.exports = (dataMapper) => {
  const majorVersion = dataMapper.version.split('\.')[0];

  return function (models, model) {
    if (!(model.prototype instanceof dataMapper.Model)) throw new Error(`${model.name} is not a sequelize Model`);
    const appliedEnhancements = {};

    const enhancements = [
      [4, model.EXSEQ_MODEL_MIXIN_SEQUELIZE_4, require('./sequelize/sequelize_4.x.x')],
      [5, model.EXSEQ_MODEL_MIXIN_SEQUELIZE_5, require('./sequelize/sequelize_5.x.x')],
      [6, model.EXSEQ_MODEL_MIXIN_SEQUELIZE_5, require('./sequelize/sequelize_6.x.x')]
    ];

    for (const enhancement of enhancements) {
      const [version, mixinApplied, fn] = enhancement;
      if (majorVersion >= version && !mixinApplied) {
        Object.assign(appliedEnhancements, fn(models, model));
      }
    }
    return new Proxy(model, {
      getPrototypeOf: function (target) {
        return target.prototype;
      },
      get: function (target, prop) {
        // console.log('PROP', prop);
        if (!target[prop]) {
          //  console.log('PROP1', prop, appliedEnhancements[prop]);

          return appliedEnhancements[prop];
        } else {
          return Reflect.get(...arguments);
        }
      }
    });
  };
};
