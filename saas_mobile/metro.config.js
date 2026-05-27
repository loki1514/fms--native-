const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Optional: cap Metro workers on memory-constrained machines.
// Set METRO_MAX_WORKERS=2 locally if you have <16GB RAM; leave unset for CI / other devs.
if (process.env.METRO_MAX_WORKERS) {
  config.maxWorkers = parseInt(process.env.METRO_MAX_WORKERS, 10);
}

// Web support
config.resolver.sourceExts.push('mjs');

// Add support for web platform
config.resolver.platforms = ['ios', 'android', 'web'];

// Don't watch test/mock/platform-irrelevant files
config.resolver.blockList = [
  /node_modules\/.*\/__tests__\/.*/,
  /node_modules\/.*\/__mocks__\/.*/,
  /node_modules\/.*\/android\/.*/,
  /node_modules\/.*\/ios\/Pods\/.*/,
];

// Fix @gorhom/portal broken internal imports (context vs contexts).
// STILL REQUIRED as of @gorhom/portal@1.0.14 (latest) — upstream has not fixed the path.
// Verified 2026-05-21 after upgrading @gorhom/bottom-sheet@5.2.14.
// TODO: Re-check after any @gorhom/portal upgrade > 1.0.14.
const portalPackage = path.resolve(__dirname, 'node_modules/@gorhom/portal/src');
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Redirect @gorhom/portal's broken ../context/portal imports to ../contexts/portal
  if (
    moduleName === '../context/portal' &&
    context.originModulePath?.includes(portalPackage)
  ) {
    return {
      filePath: path.join(portalPackage, 'contexts', 'portal.ts'),
      type: 'sourceFile',
    };
  }
  // Fallback to default resolution
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
