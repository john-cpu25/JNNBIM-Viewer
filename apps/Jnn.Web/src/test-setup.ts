import '@testing-library/jest-dom/vitest';

// jsdom has no canvas implementation; return null quietly instead of logging
// "Not implemented" so WebGL-less paths can be tested cleanly.
HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext'];
