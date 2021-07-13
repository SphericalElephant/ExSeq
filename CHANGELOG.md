# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [3.6.1] - 2021-05-12

### Added
- Added `QueryBuilder.from` to enable `QueryBuilder` configuration cloning

### Fixed
- ExSeq does not assume a default pagination for hasMany and belongsToMany queries any more

### Removed
- Removed unused dependencies 'mime-types' and 'semver-regex'

### Changed
- Moved `relationshipGet` into its own file
- Moved `unlinkRelations` into its own file
- Using modular lodash packages now

## [3.6.0] - 2021-04-21

### Added
- Added proper model extension for Sequelize 6.x.x
- Added pagination support for relationshipGet
- Added pagination support to hasMany and belongsToMany association queries

### Changed
- Restructured code, moved several methods to the model extension
- The res object now contains the errorHandler and replyHandler method instances

### Removed
- Removed rewire dev dependency

## [3.6.0] - 2020-05-29
### Added
- Added EXPERIMENTAL support for Sequelize 6.0.0-beta.6
- Added CHANGELOG.md

### Changed
- Changed the way that Sequelize version specific tests are organized
