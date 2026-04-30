/**
 * RDF stats utilities using N3.js.
 * Counts triples and distinct subject IRIs from a Turtle string.
 */

import { Parser, Store } from 'n3';

/**
 * Parse a Turtle string and return graph statistics.
 * @param {string} turtle
 * @returns {Promise<{ tripleCount: number, subjectCount: number }>}
 */
export async function computeStats(turtle) {
  return new Promise((resolve, reject) => {
    const store = new Store();
    const parser = new Parser({ format: 'Turtle' });

    parser.parse(turtle, (error, quad) => {
      if (error) {
        reject(new Error(`Turtle parse error during stats: ${error.message}`));
        return;
      }
      if (quad) {
        store.add(quad);
      } else {
        // Done — quad is null when parsing is complete
        const subjects = new Set();
        for (const q of store) {
          if (q.subject.termType === 'NamedNode') {
            subjects.add(q.subject.value);
          }
        }
        resolve({
          tripleCount: store.size,
          subjectCount: subjects.size,
        });
      }
    });
  });
}

/**
 * Parse a Turtle string into an N3 Store.
 * @param {string} turtle
 * @returns {Promise<Store>}
 */
export async function parseTurtle(turtle) {
  return new Promise((resolve, reject) => {
    const store = new Store();
    const parser = new Parser({ format: 'Turtle' });
    parser.parse(turtle, (error, quad) => {
      if (error) { reject(error); return; }
      if (quad)   store.add(quad);
      else        resolve(store);
    });
  });
}

/**
 * Query a Store for objects of a given subject+predicate.
 */
export function getStoreObjects(store, subjectValue, predicateValue) {
  return store
    .getQuads(
      { termType: 'NamedNode', value: subjectValue },
      { termType: 'NamedNode', value: predicateValue },
      null, null
    )
    .map(q => q.object.value);
}
