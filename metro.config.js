const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push('sql');
config.resolver.assetExts.push('wasm');

// expo-sqlite on web runs SQLite in a worker backed by a SharedArrayBuffer, which
// browsers only expose in a cross-origin-isolated context. The dev server doesn't
// set these headers by default (only documented for production hosting), so add
// them here too.
const { enhanceMiddleware } = config.server;
config.server.enhanceMiddleware = (middleware, metroServer) => {
  const enhanced = enhanceMiddleware ? enhanceMiddleware(middleware, metroServer) : middleware;
  return (req, res, next) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    return enhanced(req, res, next);
  };
};

module.exports = withNativeWind(config, { input: './src/global.css' });
