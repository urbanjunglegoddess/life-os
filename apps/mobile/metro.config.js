// Metro, monorepo-aware. `packages/*` lives outside this app's folder, so Metro
// has to be told to watch the workspace root and to look for modules in both
// node_modules trees — otherwise a token edit does not trigger a reload and
// hoisted dependencies resolve to nothing.
const path = require('path');

const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// Without this, a package hoisted to the root can also be found through the
// app's own tree and get bundled twice — two copies of React is the classic one.
config.resolver.disableHierarchicalLookup = true;

module.exports = withNativeWind(config, { input: './global.css' });
