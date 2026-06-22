// Registers the `three`-stubbing loader for the map-gen test.
import { register } from 'node:module';
register('./loader.mjs', import.meta.url);
