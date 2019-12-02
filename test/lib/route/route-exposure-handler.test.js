'use strict';

/* eslint-env node, mocha */
/* eslint no-unused-expressions: "off" */
/* eslint max-len: ["error", { code: 140, "ignoreTemplateLiterals": true }] */

const {expect} = require('chai');
const {RouteExposureHandler} = require('../../../lib/route');
const sinon = require('sinon');

describe('RouteExposureHandler', () => {
  describe('isRouteExposed', () => {
    it('should expose a route if no rules were specified', () => {
      expect(new RouteExposureHandler({}).isRouteExposed('get', '/:id')).to.be.true;
    });
    it('should expose a route if no rules for the method were specified but rules for other methods were specified', () => {
      const rules = new RouteExposureHandler({
        '/': {
          post: false
        }
      });
      expect(rules.isRouteExposed('get', '/')).to.be.true;
      expect(rules.isRouteExposed('post', '/')).to.be.false;
      expect(rules.isRouteExposed('head', '/')).to.be.true;
      expect(rules.isRouteExposed('put', '/')).to.be.true;
      expect(rules.isRouteExposed('patch', '/')).to.be.true;
    });
    it('should not expose a route if specified', () => {
      expect(new RouteExposureHandler({
        '/:id': {
          get: false
        }}).isRouteExposed('get', '/:id')).to.be.false;
    });
    it('should expose a route if specified', () => {
      expect(new RouteExposureHandler({
        '/:id': {
          get: true
        }
      }).isRouteExposed('get', '/:id')).to.be.true;
    });
    it('should print an error if the user exposed /search via GET', () => {
      const consoleStub = sinon.stub(console, 'error');
      new RouteExposureHandler({
        '/search': {
          get: true
        }
      }).isRouteExposed('get', '/search');
      consoleStub.restore();
      expect(consoleStub.calledOnceWith('exposing /search via GET will be removed.')).to.be.true;
    });
    it('should not print an error if the user exposed /search via POST', () => {
      const consoleStub = sinon.stub(console, 'error');
      new RouteExposureHandler({
        '/search': {
          post: true
        }
      }).isRouteExposed('post', '/search');
      consoleStub.restore();
      expect(consoleStub.calledOnceWith('exposing /search via GET will be removed.')).to.be.false;
    });
  });
});
