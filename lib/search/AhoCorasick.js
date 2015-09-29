'use strict';

exports.__esModule = true;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _assert = require('assert');

var _assert2 = _interopRequireDefault(_assert);

var ROOT = 0;
var EMPTY = -1;

/**
 * This is an attempt at an online version of AhoCorasick. If treated as offline
 * it will have the same running time as the standard algorithm O(n + m + z), if
 * you mutate the structure it will return the correct results, but may take the
 * same amount of time to update as the initial construction (i.e. I make no
 * guarantees about how add/delete affect the runtime after the first query).
 */

var AhoCorasick = (function () {
  function AhoCorasick() {
    _classCallCheck(this, AhoCorasick);

    this._dict = new Set();
    this._ghosts = new Set();

    this._next = ROOT + 1;
    this._nodes = {};

    // Define the root node.
    this._nodes[ROOT] = {
      char: '',
      children: {},
      end: false, // Root doesn't match anything.
      suffixOf: {},
      parent: EMPTY, // No parent, use -1 so everything else isn't ?number.

      suffix: ROOT,
      word: ''
    };
  }

  /**
   * Adds a word to the structure.
   */

  AhoCorasick.prototype.add = function add(word) {
    !word ? process.env.NODE_ENV !== 'production' ? _assert2['default'](false, 'Cannot add empty strings to the structure.') : _assert2['default'](false) : undefined;

    // Add the word to our dictionary.
    if (this._dict.has(word)) {
      return;
    }
    this._dict.add(word);
    this._ghosts['delete'](word);

    // Then add it to the trie.
    var n = this._nodes;
    var curr = ROOT;
    for (var i = 0; i < word.length; i++) {
      var _char = word.charAt(i);
      if (n[curr].children[_char]) {
        curr = n[curr].children[_char];
        // If this is the last charcter make sure it's marked as an end node.
        if (i === word.length - 1) {
          n[curr].end = true;
        }
      } else {
        // Add the new node.
        var newNode = {
          char: _char,
          children: {},
          end: i === word.length - 1,
          suffixOf: {},
          parent: curr,

          suffix: null, // Doesn't suffix to anything yet.
          word: null
        };

        // Recursively clear the suffix of anything that has the parent (curr)
        // as a suffix node.
        // TODO: Thoroughly confirm and test this logic. It's non-standard.
        this._clearSuffixes(curr);

        // Update node and next pointers.
        var next = this._next + 1;
        n[next] = newNode;
        n[curr].children[_char] = next;
        curr = next;
        this._next = next;
      }
    }
  };

  /**
   * Deletes a word from the structure.
   */

  AhoCorasick.prototype['delete'] = function _delete(word) {
    // Remove the word from our dictionary.
    if (!this._dict.has(word)) {
      return;
    }
    this._dict['delete'](word);
    this._ghosts.add(word);

    // Check if we should rebuild the trie due to many ghost nodes.
    // TODO: Implement this.

    // Then remove it from the trie.
    var n = this._nodes;
    var curr = ROOT;
    for (var i = 0; i < word.length; i++) {
      var _char2 = word.charAt(i);
      !n[curr].children[_char2] ? process.env.NODE_ENV !== 'production' ? _assert2['default'](false, 'Unexpected missing child while deleting a node') : _assert2['default'](false) : undefined;
      curr = n[curr].children[_char2];
    }
    n[curr].end = false;
  };

  /**
   * Finds all words in the structure that occur within the haystack.
   *
   * TODO: Also return indices.
   */

  AhoCorasick.prototype.query = function query(haystack) {
    var results = new Set();
    var n = this._nodes;
    var curr = ROOT;
    for (var i = 0; i < haystack.length; i++) {
      var _char3 = haystack.charAt(i);
      curr = this._transition(curr, _char3);

      // Always safe to do after the first transition since root can't match.
      if (n[curr].end) {
        var words = this._getWords(curr);
        for (var j = 0; j < words.length; j++) {
          results.add(words[j]);
        }
      }
    }
    return results;
  };

  /**
   * Get the suffix of node. Memoizes the value if it is not yet computed.
   */

  AhoCorasick.prototype._getSuffix = function _getSuffix(node) {
    var n = this._nodes;
    var suffix = n[node].suffix;
    if (suffix != null) {
      return suffix;
    }

    // Update the suffix since it was not yet set.
    suffix = n[node].parent === ROOT ? ROOT : this._transition(this._getSuffix(n[node].parent), n[node].char);

    // Update the suffix of node and return.
    n[node].suffix = suffix;
    return suffix;
  };

  /**
   * Figure out the next node after consuming char.
   */

  AhoCorasick.prototype._transition = function _transition(node, char) {
    var n = this._nodes;

    // If it has a child of this character just move to it.
    if (n[node].children[char] != null) {
      return n[node].children[char];
    }

    // Just stay at the root if we failed to progress.
    if (node === ROOT) {
      return ROOT;
    }

    // Otherwise try to follow the suffix.
    return this._transition(this._getSuffix(node), char);
  };

  /**
   * Gets the word for a node, memoizes the result so we only save large strings
   * for values that have been matched. If we saved the word for every node the
   * memory complexity could grow to O(m^2) where m is the SUM of the length of
   * all words in the structure.
   */

  AhoCorasick.prototype._getWord = function _getWord(node) {
    var n = this._nodes;
    var word = n[node].word;
    if (word != null) {
      return word;
    }

    word = this._getWord(n[node].parent) + n[node].char;
    n[node].word = word;
    return word;
  };

  /**
   * Gets all of the words in the output of a given node.
   *
   * TODO: This is probably a shitty implementation. Memoize it and make sure to
   * clear it when clearing suffixes in "add()".
   */

  AhoCorasick.prototype._getWords = function _getWords(node) {
    var result = [];
    var n = this._nodes;
    if (n[node].end) {
      result.push(this._getWord(node));
    }

    var curr = node;
    while (curr !== ROOT) {
      curr = this._getSuffix(curr);
      if (n[curr].end) {
        result.push(this._getWord(curr));
      }
    }

    return result;
  };

  /**
   * Recursively clear anything that has this node as a suffix.
   */

  AhoCorasick.prototype._clearSuffixes = function _clearSuffixes(node) {
    var toClear = Object.keys(this._nodes[node].suffixOf);
    for (var i = 0; i < toClear.length; i++) {
      var clear = toClear[i];
      // Make sure not to infinite loop. This should only happen when this
      // method is called with the root node. No other node should be a suffix
      // of itself. Note that it is important we visit other nodes in suffixOf
      // on the root node.
      if (clear === node) {
        continue;
      }

      // Update the references, node is not a suffix of clear.
      delete this._nodes[node].suffixOf[clear];
      // And clear no longer has the suffix node.
      this._nodes[clear].suffix = null;

      // Recurseively clear the node we just removed.
      this._clearSuffixes(clear);
    }
  };

  return AhoCorasick;
})();

exports['default'] = AhoCorasick;
module.exports = exports['default'];

// These are computed lazily as needed.