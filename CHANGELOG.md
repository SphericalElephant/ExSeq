# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
