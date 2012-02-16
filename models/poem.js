/**
 * @fileoverview defines the poem model.
 */

/**
 * Type definition for Poem model.
 */
var Poem = {
  id: null,
  words: [],
};

if (typeof module === 'undefined') {
  Poem.words = Backbone.Collection.extend({
    model: Word
  });
  // Set usable defaults.
  if (typeof window.MagPo === 'undefined') {
    window.MagPo = { models: {} };
  }
  else if (typeof window.MagPo.models === 'undefined') {
    window.MagPo.models = {};
  }
  window.MagPo.models.Poem = Poem;
}
else {
  var Word = require('./word');
  Poem.words = [ Word ];
  Poem.author = String;
  module.exports = Poem;
}
