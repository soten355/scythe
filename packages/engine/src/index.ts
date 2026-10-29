// Pure rules engine: no DOM, no clock, no unseeded randomness, no imports from app.
// Bump ENGINE_VERSION whenever rules change in a way that affects saved games.
export const ENGINE_VERSION = '0.0.0';

export * from './rng';
export * from './board';
export * from './game';
export * from './state';
export { RESOURCES, TERRAIN_PRODUCES } from './top-actions';
export * from './mat';
export * from './faction';
