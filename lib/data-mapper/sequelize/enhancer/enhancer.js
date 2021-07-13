'use strict';

module.exports = {
  SequelizeEnhancer: class SequelizeEnhancer {
    constructor(dataMapper, majorVersion, models) {
      this.dataMapper = dataMapper;
      this.majorVersion = majorVersion;
      this.models = models;
    }
    enhance(model) {
      if (!(model.prototype instanceof this.dataMapper.Model)) throw new Error(`${model.name} is not a sequelize Model`);
      const appliedEnhancements = {};

      const enhancements = [
        [4, model.EXSEQ_MODEL_MIXIN_SEQUELIZE_4, require('./enhancements/sequelize_4.x.x')],
        [5, model.EXSEQ_MODEL_MIXIN_SEQUELIZE_5, require('./enhancements/sequelize_5.x.x')],
        [6, model.EXSEQ_MODEL_MIXIN_SEQUELIZE_6, require('./enhancements/sequelize_6.x.x')]
      ];

      for (const enhancement of enhancements) {
        const [version, mixinApplied, fn] = enhancement;
        if (this.majorVersion >= version && !mixinApplied) {
          Object.assign(appliedEnhancements, fn(this.models, model));
        }
      }
      return new Proxy(model, {
        getPrototypeOf: function (target) {
          return target.prototype;
        },
        get: function (target, prop) {
          // console.log('PROP', prop);
          if (!target[prop]) {
            // console.log('PROP1', prop, appliedEnhancements[prop]);

            return appliedEnhancements[prop];
          } else {
            return Reflect.get(...arguments);
          }
        }
      });
    }
  }
};
