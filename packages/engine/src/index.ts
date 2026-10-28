// Pure rules engine: no DOM, no clock, no unseeded randomness, no imports from app.
// Bump ENGINE_VERSION whenever rules change in a way that affects saved games.
export const ENGINE_VERSION = '0.0.0';

export * from './rng';
