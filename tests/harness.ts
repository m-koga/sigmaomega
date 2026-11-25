// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// Test loader: runs the page script from src/ on stand-in objects instead of a real DOM
// and exposes the computation functions to the tests. No external libraries are used.
import path from 'node:path';
import vm from 'node:vm';

import { build, buildScript } from '../scripts/build.ts';

const HTML_PATH = path.join(import.meta.dirname, '..', 'index.html');

/** The page script as the tests see it: every top-level name (AppApi, generated in tests/app-api.d.ts),
 *  plus setLang/getLang, which set and read only the language variable (no UI rebuild) */
type Api = Omit<AppApi, 'setLang'> & { setLang(l: string): void; getLang(): string };
/** Options of load(): browser languages, e.g. ['en-US', 'en'] */
interface LoadOptions {
  languages?: string[];
}
/** Stand-in for any object of the page (elements, style, ...): every property is allowed */
type Stub = Record<string | symbol, any>;

// Stand-in element that tolerates any operation (remembers assigned values)
function makeElement(): Stub {
  const store: Stub = { value: '', textContent: '', innerHTML: '', checked: false, title: '' };
  const style = new Proxy<Stub>(
    {},
    {
      get: (t, k) => (k === 'setProperty' || k === 'removeProperty' ? () => {} : (t[k] ?? '')),
      set: (t, k, v) => {
        t[k] = v;
        return true;
      },
    },
  );
  const classList = { add() {}, remove() {}, toggle() {}, contains: () => false };
  return new Proxy(store, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'style') return style;
      if (k === 'classList') return classList;
      if (k === 'dataset') return (t.dataset = t.dataset || {});
      if (k === 'parentElement' || k === 'firstChild') return makeElement();
      if (k === 'getBoundingClientRect') return () => ({ x: 0, y: 0, width: 0, height: 0, left: 0, top: 0 });
      if (k === 'querySelector') return () => makeElement();
      if (k === 'closest') return () => null;
      if (k === 'querySelectorAll') return () => [];
      if (k === 'clientWidth' || k === 'clientHeight' || k === 'offsetWidth' || k === 'offsetHeight') return 0;
      if (k === 'offsetParent') return null;
      return () => {};
    },
    set(t, k, v) {
      t[k] = v;
      return true;
    },
  });
}

// The page script without its start-up file, and the built page (read from src/ once per test process)
let cache: { script: string; html: string } | null = null;
const sources = () => cache || (cache = { script: buildScript({ withInit: false }).js, html: build().html });

// Load the page script from src/ (without building the page) and return { api, html }.
// api gives every top-level name of the script (functions, constants, state), e.g. api.S, api.simulate;
// a fresh, independent copy is made on every call. opts.languages: browser languages, e.g. ['en-US', 'en']
function load(opts: LoadOptions = {}): { api: Api; html: string } {
  const { script, html } = sources();
  const elements = new Map<string, Stub>();
  const document = {
    getElementById: (id: string) => {
      if (!elements.has(id)) elements.set(id, makeElement());
      return elements.get(id);
    },
    querySelector: () => makeElement(),
    querySelectorAll: () => [],
    createElement: () => makeElement(),
    createTreeWalker: () => ({ nextNode: () => false }),
    addEventListener() {},
    documentElement: makeElement(),
    body: makeElement(),
    activeElement: null,
    title: '',
  };
  const sandbox: Stub = {
    document,
    navigator: { language: (opts.languages || ['ja'])[0], languages: opts.languages || ['ja'] }, // browser languages (default: Japanese)
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    getComputedStyle: () => ({ fontSize: '14px', getPropertyValue: () => '' }),
    requestAnimationFrame: (f: () => void) => setTimeout(f, 0),
    setTimeout,
    clearTimeout,
    console,
    Math,
    JSON,
    TextEncoder,
    TextDecoder,
    atob,
    btoa,
    location: { href: 'https://example.org/index.html', hash: '' },
    addEventListener() {},
    removeEventListener() {},
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(script, sandbox, { filename: 'src/ts (page script)' });
  return { api: makeApi(sandbox), html };
}

// Access to the top-level names of the script in the sandbox. Top-level const/let/function of a classic
// script live in the global scope of its realm, so a name is read by evaluating it there.
function makeApi(sandbox: vm.Context): Api {
  const own = {
    setLang: (l: string) => vm.runInContext(`LANG = ${JSON.stringify(l)}`, sandbox), // only the language variable, no UI rebuild
    getLang: () => vm.runInContext('LANG', sandbox),
  };
  return new Proxy(own as Api, {
    get(_t, k) {
      if (k in own) return own[k as keyof typeof own];
      if (typeof k !== 'string' || k === 'then' || !/^[A-Za-z_$][\w$]*$/.test(k)) return undefined;
      try {
        return vm.runInContext(k, sandbox);
      } catch (e) {
        return undefined;
      } // read on every access (variables may be reassigned)
    },
  });
}

// Note: the loaded script runs in a separate realm (vm), so Errors and arrays created there
// do not match this file's Error/Array under instanceof or strict comparison. Convert to plain values before comparing.

// Helpers
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
// Value at the recorded point nearest to time t
function at(sim: { T: number[] } & Record<string, unknown>, t: number, key = 'Y'): number {
  let i = 0;
  while (i + 1 < sim.T.length && sim.T[i + 1] <= t) i++;
  return (sim[key] as number[])[i];
}

// Last element of an array
const last = (a: number[]): number => a[a.length - 1];
// A value the test needs (fails the test with a clear message when it is null or undefined; narrows the type)
function defined<T>(x: T | null | undefined, what = 'value'): T {
  if (x === null || x === undefined) throw new Error(`${what} is ${x}`);
  return x;
}
// A tuning result that is not an error (fails the test with the error code otherwise)
function success<R extends { err?: string }>(r: R): Exclude<R, { err: string }> {
  if (r.err !== undefined) throw new Error(`tuning failed: ${r.err}`);
  return r as Exclude<R, { err: string }>;
}

// A freshly loaded copy of the page script (independent state for each test)
const fresh = (opts?: LoadOptions) => load(opts).api;
// Plain copy of a value created in the page realm (for deepEqual and instanceof)
const plain = <T>(v: T): T => JSON.parse(JSON.stringify(v));

export { load, fresh, plain, near, at, last, defined, success, HTML_PATH };
