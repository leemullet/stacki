const fs = require('node:fs');
const path = require('node:path');

// electron-builder strips `build` from packaged package.json. The installed
// app must detect the generated resource, not the development-only setting.
function hasConfiguredUpdateFeed({ isPackaged, resourcesPath, packageInfo, existsSync = fs.existsSync }) {
  return isPackaged
    ? !!resourcesPath && existsSync(path.join(resourcesPath, 'app-update.yml'))
    : !!packageInfo?.build?.publish;
}

module.exports = { hasConfiguredUpdateFeed };
