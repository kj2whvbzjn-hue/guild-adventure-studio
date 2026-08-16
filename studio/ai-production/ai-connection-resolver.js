(function (root, factory) {
  const shared = typeof module === 'object' && module.exports ? require('../../shared/ai/ai-connection-resolver.js') : root && root.GKSAIConnectionResolver;
  const api = factory(shared);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GKSAIConnectionResolver = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Shared) {
  'use strict';
  if (!Shared) throw new Error('Shared GKSAIConnectionResolver is required');
  return Shared;
});
