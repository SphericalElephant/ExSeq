'use strict';

class RouteExposureHandler {
  constructor(exposedRoutes) {
    this.exposedRoutes = exposedRoutes;
  }

  isRouteExposed(httpVerb, route) {
    const result =
      !this.exposedRoutes[route] ||
      (this.exposedRoutes[route][httpVerb] === null || this.exposedRoutes[route][httpVerb] === undefined) ||
      !this.exposedRoutes[route][httpVerb] === false;
    if (this.exposedRoutes[route] && this.exposedRoutes[route][httpVerb] === true && route === '/search' && httpVerb === 'get') {
      console.error('exposing /search via GET will be removed.');
    }
    return result;
  }
}
module.exports = RouteExposureHandler;
