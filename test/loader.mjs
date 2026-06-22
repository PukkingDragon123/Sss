// A tiny ESM loader that redirects bare `three` imports to our stub, so
// runmap.js can be unit-tested in Node without the real Three.js / a browser.
import { pathToFileURL } from 'node:url';
const STUB = pathToFileURL(new URL('./three-stub.mjs', import.meta.url).pathname).href;
export async function resolve(specifier, context, next) {
  if (specifier === 'three') return { url: STUB, shortCircuit: true };
  return next(specifier, context);
}
