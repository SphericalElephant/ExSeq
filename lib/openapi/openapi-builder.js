'use strict';

class OpenApiBuilder {
  constructor(opts) {
  }

  static createIdParameterSpecification(model) {
  }

  static convert(model) {
  }

  getPathOptions(path) {
  }

  createPathItemStub(path) {
  }

  createBasePathSpecification(path, operation) {
  }

  createModelPathSpecification(operation) {
  }

  createCountModelPathSpecification() {
  }

  createSearchModelPathSpecification() {
  }

  createInstancePathSpecification(operation) {
  }

  createHasOneOrBelongsToPathSpecification(operation, target, targetPath) {
  }

  createHasManyOrBelongsToManyPathSpecfication(operation, target, targetPath) {
  }

  createCountHasManyOrBelongsToManyPathSpecfication(target, targetPath) {
  }

  createSearchHasManyOrBelongsToManyPathSpecfication(target, targetPath) {
  }

  createHasManyOrBelongsToManyInstancePathSpecfication(operation, target, targetPath) {
  }

  createLinkBelongsToManyPathSpecification(target, targetPath) {
  }

  createUnlinkBelongsToManyPathSpecification(target, targetPath) {
  }
}

module.exports = OpenApiBuilder;
