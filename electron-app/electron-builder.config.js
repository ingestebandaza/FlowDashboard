const path = require('path');

const versionInfo = require('../version.json');

const productName = versionInfo.productName || 'FlowDashboard';
const appId = 'com.flowdashboard.app';

module.exports = {
  appId,
  productName,
  artifactName: `${productName}-Setup-\${version}.\${ext}`,
  asar: true,
  compression: 'maximum',
  npmRebuild: false,
  nodeGypRebuild: false,
  buildDependenciesFromSource: false,
  directories: {
    output: '../release_packages',
    buildResources: 'assets'
  },
  publish: [
    {
      provider: 'github',
      owner: 'ingestebandaza',
      repo: 'FlowDashboard',
      releaseType: 'release'
    }
  ],
  files: [
    'src/**/*',
    'preload/**/*',
    'assets/**/*',
    'package.json',
    'node_modules/**/*',
    '!dist/**/*',
    '!electron-console.log',
    '!*.log',
    '!install-ffi.bat',
    '!node_modules/.cache/**/*',
    '!node_modules/electron/dist/**/*',
    '!node_modules/electron-builder/**/*',
    '!node_modules/app-builder-bin/**/*',
    '!node_modules/app-builder-lib/**/*',
    '!node_modules/builder-util/**/*',
    '!node_modules/dmg-builder/**/*',
    '!node_modules/nsis/**/*',
    '!node_modules/winCodeSign/**/*'
  ],
  extraResources: [
    {
      from: '../build/staging/commercial-resources',
      to: '.',
      filter: ['**/*']
    },
    {
      from: 'assets',
      to: 'assets',
      filter: ['**/*']
    }
  ],
  win: {
    target: [
      {
        target: 'nsis',
        arch: ['x64']
      }
    ],
    icon: 'assets/icon.ico',
    publisherName: 'FlowDashboard',
    signAndEditExecutable: false,
    signDlls: false,
    forceCodeSigning: false
  },
  nsis: {
    oneClick: true,
    perMachine: false,
    allowElevation: false,
    allowToChangeInstallationDirectory: false,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: productName,
    deleteAppDataOnUninstall: false
  }
};
