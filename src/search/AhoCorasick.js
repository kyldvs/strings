/**
 * @flow
 */

import invariant from 'assert';

type Node = {
  char: string,
  children: {[key: string]: number},
  end: boolean,
  parent: number,
  suffixOf: {[key: number]: boolean},

  // These are computed lazily as needed.
  suffix: ?number,
  word: ?string,
};

const ROOT = 0;
const EMPTY = -1;

/**
 * This is an attempt at an online version of AhoCorasick. If treated as offline
 * it will have the same running time as the standard algorithm O(n + m + z), if
 * you mutate the structure it will return the correct results, but may take the
 * same amount of time to update as the initial construction (i.e. I make no
 * guarantees about how add/delete affect the runtime after the first query).
 */
export default class AhoCorasick {
  _dict: Set<string>;
  _ghosts: Set<string>;

  _next: number;
  _nodes: {[key: number]: Node};

  constructor() {
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
      word: '',
    };
  }

  /**
   * Adds a word to the structure.
   */
  add(word: string): void {
    invariant(word, 'Cannot add empty strings to the structure.');

    // Add the word to our dictionary.
    if (this._dict.has(word)) {
      return;
    }
    this._dict.add(word);
    this._ghosts.delete(word);

    // Then add it to the trie.
    const n = this._nodes;
    let curr = ROOT;
    for (let i = 0; i < word.length; i++) {
      const char = word.charAt(i);
      if (n[curr].children[char]) {
        curr = n[curr].children[char];
        // If this is the last charcter make sure it's marked as an end node.
        if (i === word.length - 1) {
          n[curr].end = true;
        }
      } else {
        // Add the new node.
        const newNode = {
          char,
          children: {},
          end: i === word.length - 1,
          suffixOf: {},
          parent: curr,

          suffix: null, // Doesn't suffix to anything yet.
          word: null,
        };

        // Recursively clear the suffix of anything that has the parent (curr)
        // as a suffix node.
        // TODO: Thoroughly confirm and test this logic. It's non-standard.
        this._clearSuffixes(curr);

        // Update node and next pointers.
        const next = this._next + 1;
        n[next] = newNode;
        n[curr].children[char] = next;
        curr = next;
        this._next = next;
      }
    }
  }

  /**
   * Deletes a word from the structure.
   */
  delete(word: string): void {
    // Remove the word from our dictionary.
    if (!this._dict.has(word)) {
      return;
    }
    this._dict.delete(word);
    this._ghosts.add(word);

    // Check if we should rebuild the trie due to many ghost nodes.
    // TODO: Implement this.

    // Then remove it from the trie.
    const n = this._nodes;
    let curr = ROOT;
    for (let i = 0; i < word.length; i++) {
      const char = word.charAt(i);
      invariant(
        n[curr].children[char],
        'Unexpected missing child while deleting a node',
      );
      curr = n[curr].children[char];
    }
    n[curr].end = false;
  }

  /**
   * Finds all words in the structure that occur within the haystack.
   *
   * TODO: Also return indices.
   */
  query(haystack: string): Set<string> {
    const results = new Set();
    const n = this._nodes;
    let curr = ROOT;
    for (let i = 0; i < haystack.length; i++) {
      const char = haystack.charAt(i);
      curr = this._transition(curr, char);

      // Always safe to do after the first transition since root can't match.
      if (n[curr].end) {
        const words = this._getWords(curr);
        for (let j = 0; j < words.length; j++) {
          results.add(words[j]);
        }
      }
    }
    return results;
  }

  /**
   * Get the suffix of node. Memoizes the value if it is not yet computed.
   */
  _getSuffix(node: number): number {
    const n = this._nodes;
    let suffix = n[node].suffix;
    if (suffix != null) {
      return suffix;
    }

    // Update the suffix since it was not yet set.
    suffix = n[node].parent === ROOT
      ? ROOT
      : this._transition(this._getSuffix(n[node].parent), n[node].char);

    // Update the suffix of node and return.
    n[node].suffix = suffix;
    return suffix;
  }

  /**
   * Figure out the next node after consuming char.
   */
  _transition(node: number, char: string): number {
    const n = this._nodes;

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
  }

  /**
   * Gets the word for a node, memoizes the result so we only save large strings
   * for values that have been matched. If we saved the word for every node the
   * memory complexity could grow to O(m^2) where m is the SUM of the length of
   * all words in the structure.
   */
  _getWord(node: number): string {
    const n = this._nodes;
    let word = n[node].word;
    if (word != null) {
      return word;
    }

    word = this._getWord(n[node].parent) + n[node].char;
    n[node].word = word;
    return word;
  }

  /**
   * Gets all of the words in the output of a given node.
   *
   * TODO: This is probably a shitty implementation. Memoize it and make sure to
   * clear it when clearing suffixes in "add()".
   */
  _getWords(node: number): Array<string> {
    const result = [];
    const n = this._nodes;
    if (n[node].end) {
      result.push(this._getWord(node));
    }

    let curr = node;
    while (curr !== ROOT) {
      curr = this._getSuffix(curr);
      if (n[curr].end) {
        result.push(this._getWord(curr));
      }
    }

    return result;
  }

  /**
   * Recursively clear anything that has this node as a suffix.
   */
  _clearSuffixes(node: number): void {
    const toClear = Object.keys(this._nodes[node].suffixOf);
    for (let i = 0; i < toClear.length; i++) {
      const clear = toClear[i];
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
  }
}
