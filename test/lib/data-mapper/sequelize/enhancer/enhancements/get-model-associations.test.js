'use strict';

const {expect} = require('chai');

const AssociationInformation = require('../../../../../../lib/association-information');
const {enhance} = require('../../../../../../lib/data-mapper');

module.exports = (Sequelize) => {
  const database = require('../../../../../database')(Sequelize);
  const modelExtension = enhance(database.Sequelize);

  describe('getModelAssociations - CAREFUL THESE TEST WILL HANG IF EXPECT FAILS! - CHAI', () => {
    const m = {
      HasOneSource: database.sequelize.define('HasOneSource', {}),
      HasOneTarget: database.sequelize.define('HasOneTarget', {}),

      HasManySource: database.sequelize.define('HasManySource', {}),
      HasManyTarget: database.sequelize.define('HasManyTarget', {}),

      BelongsToSource: database.sequelize.define('BelongsToSource', {}),
      BelongsToTarget: database.sequelize.define('BelongsToTarget', {}),

      BelongsToManySource: database.sequelize.define('BelongsToManySource', {}),
      BelongsToManyTarget: database.sequelize.define('BelongsToManyTarget', {}),
      BelongsToManyThrough: database.sequelize.define('BelongsToManyThrough', {}),

      MultiSource: database.sequelize.define('MultiSource', {}),
      MultiSourceThrough: database.sequelize.define('MultiSourceThrough', {}),
      CustomFKSource: database.sequelize.define('CustomFKSource', {}),
      CustomFKTarget: database.sequelize.define('CustomFKTarget', {})
    };

    m.HasOneSource.hasOne(m.HasOneTarget);
    m.HasManySource.hasMany(m.HasManyTarget);
    m.BelongsToSource.belongsTo(m.BelongsToTarget);
    m.BelongsToManySource.belongsToMany(m.BelongsToManyTarget, {through: m.BelongsToManyThrough});

    m.MultiSource.hasOne(m.HasOneTarget);
    m.MultiSource.hasMany(m.HasManyTarget);
    m.MultiSource.belongsTo(m.BelongsToTarget);
    m.MultiSource.belongsToMany(m.BelongsToManyTarget, {through: m.MultiSourceThrough});

    m.CustomFKSource.hasOne(m.CustomFKTarget, {as: 'target', foreignKey: 'target_id'});

    const modelDefinitions = [
      {model: m.HasOneSource, opts: {}},
      {model: m.HasOneTarget, opts: {}},
      {model: m.HasManySource, opts: {}},
      {model: m.HasManyTarget, opts: {}},
      {model: m.BelongsToSource, opts: {}},
      {model: m.BelongsToTarget, opts: {}},
      {model: m.BelongsToManySource, opts: {}},
      {model: m.BelongsToManyTarget, opts: {}},
      {model: m.MultiSource, opts: {}},
      {model: m.CustomFKSource, opts: {}},
      {model: m.CustomFKTarget, opts: {}}];

    for (const modelKey of Object.keys(m)) {
      m[modelKey] = modelExtension(
        modelDefinitions,
        m[modelKey]
      );
    }

    const {
      HasOneSource,
      HasOneTarget,
      HasManySource,
      HasManyTarget,
      BelongsToSource,
      BelongsToTarget,
      BelongsToManySource,
      BelongsToManyTarget,
      BelongsToManyThrough,
      MultiSource,
      MultiSourceThrough,
      CustomFKSource,
      CustomFKTarget
    } = m;

    const models = Object.values(m);

    it.skip('should return a list of all relationships, include the foreign key fields of a model', () => {
      /* expect(MultiSource.getModelAssociations()).to.deep.equal([{
        source: MultiSource,
        target: HasOneTarget,
        associationType: 'HasOne',
        fk: 'MultiSourceId',
        as: 'HasOneTarget'
      },
      {
        source: MultiSource,
        target: HasManyTarget,
        associationType: 'HasMany',
        fk: 'MultiSourceId',
        as: 'HasManyTargets'
      },
      {
        source: MultiSource,
        target: BelongsToTarget,
        associationType: 'BelongsTo',
        fk: 'BelongsToTargetId',
        as: 'BelongsToTarget'
      },
      {
        source: MultiSource,
        target: BelongsToManyTarget,
        associationType: 'BelongsToMany',
        through: MultiSourceThrough,
        sourceFk: 'MultiSourceId',
        targetFk: 'BelongsToManyTargetId',
        as: 'BelongsToManyTargets'
      }]); */
      /*
      expect(HasOneSource.getModelAssociations()).to.deep.equal(
        [{
          source: HasOneSource,
          target: HasOneTarget,
          associationType: 'HasOne',
          fk: 'HasOneSourceId',
          as: 'HasOneTarget'
        }]
      );
      expect(HasManySource.getModelAssociations()).to.deep.equal(
        [{
          source: HasManySource,
          target: HasManyTarget,
          associationType: 'HasMany',
          fk: 'HasManySourceId',
          as: 'HasManyTargets'
        }]
      );
      expect(BelongsToSource.getModelAssociations()).to.deep.equal(
        [{
          source: BelongsToSource,
          target: BelongsToTarget,
          associationType: 'BelongsTo',
          fk: 'BelongsToTargetId',
          as: 'BelongsToTarget'
        }]
      );

      expect(BelongsToManySource.getModelAssociations()).to.deep.equal(
        [{
          source: BelongsToManySource,
          target: BelongsToManyTarget,
          associationType: 'BelongsToMany',
          through: BelongsToManyThrough,
          sourceFk: 'BelongsToManySourceId',
          targetFk: 'BelongsToManyTargetId',
          as: 'BelongsToManyTargets'
        }]
      ); */
    });
    it('should be able to handle custom foreign keys', () => {
      expect(CustomFKSource.getModelAssociations()[0].fk).to.equal('target_id');
    });
    describe('AssociationInformation', () => {
      it('should check check for null models', () => {
        try {
          new AssociationInformation(null);
        } catch (err) {
          expect(err.message).to.equal('no models provided.');
        }
      });
      describe('createAssociationInformation', () => {
        const associationInformation = new AssociationInformation(models);
        associationInformation.createAssociationInformation();
        it.skip('should create a lookup table that maps all models to their respective association.', () => {
          expect(associationInformation.getAssociationInformation(HasOneTarget)).to.deep.equal(
            [{
              source: HasOneSource,
              target: HasOneTarget,
              associationType: 'HasOne',
              fk: 'HasOneSourceId',
              as: 'HasOneTarget'
            },
            {
              source: MultiSource,
              target: HasOneTarget,
              associationType: 'HasOne',
              fk: 'MultiSourceId',
              as: 'HasOneTarget'
            }]
          );
          expect(associationInformation.getAssociationInformation(CustomFKTarget)).to.deep.equal(
            [{
              source: CustomFKSource,
              target: CustomFKTarget,
              associationType: 'HasOne',
              fk: 'target_id',
              as: 'target'
            }]
          );
        });
        it('should check for invalid models', () => {
          const associationInformation = new AssociationInformation([{}]);
          expect(associationInformation.createAssociationInformation.bind(associationInformation)).to.throw('invalid model');
        });
      });
      describe('getAssociationInformation', () => {
        it('should throw an error if the association information was not created yet', () => {
          const associationInformation = new AssociationInformation(models);
          expect(associationInformation.getAssociationInformation.bind(associationInformation, HasOneTarget))
            .to.throw('association information not initialized!');
        });
        it('should allow foreign key lookups', () => {
          const associationInformation = new AssociationInformation(models);
          associationInformation.createAssociationInformation();
          // maybe https://stackoverflow.com/questions/51096547/how-to-get-the-target-of-a-javascript-proxy ???
          console.log('WAT', HasOneSource.name === associationInformation.getAssociationInformation('HasOneSourceId')[0].source.name);
          expect(associationInformation.getAssociationInformation('HasOneSourceId')[0]).to.deep.equal({
            source: HasOneSource,
            target: HasOneTarget,
            associationType: 'HasOne',
            fk: 'HasOneSourceId',
            as: 'HasOneTarget'
          });
          expect(associationInformation.getAssociationInformation('MultiSourceId')).to.have.lengthOf(3);
          expect(associationInformation.getAssociationInformation('BelongsToManyTargetId')).to.have.lengthOf(2);
        });
      });
    });
  });
};
