(function (root, factory) {
  const shared = typeof module === 'object' && module.exports ? require('../../shared/ai/ai-program-validator.js') : root && root.GKSAIProgramValidator;
  const api = factory(shared);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GKSAIProgramValidator = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Shared) {
  'use strict';
  if (!Shared) throw new Error('Shared GKSAIProgramValidator is required');
  return Shared;
});
