const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Web support
config.resolver.sourceExts.push('mjs');

// Add support for web platform
config.resolver.platforms = ['ios', 'android', 'web'];

// Fix @gorhom/portal broken internal imports (context vs contexts)
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
