import '@testing-library/jest-dom/vitest';

// jsdom has no layout: give elements a non-zero size so the board can animate.
const rect = { x: 0, y: 0, top: 0, left: 0, bottom: 50, right: 50, width: 50, height: 50, toJSON: () => ({}) };
Element.prototype.getBoundingClientRect = function () {
  return rect as DOMRect;
};
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;
