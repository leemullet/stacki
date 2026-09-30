const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const { hasConfiguredUpdateFeed } = require('../electron/updateConfig');
const main = fs.readFileSync(path.join(__dirname, '../electron/main.js'), 'utf8');
const code = main.slice(main.indexOf('const AUTO_UPDATE_CHECK_INTERVAL_MS'), main.indexOf('// Helpers', main.indexOf('const AUTO_UPDATE_CHECK_INTERVAL_MS')));
test('installed app detects its packaged feed without build metadata', async () => {
  const pkgFile = path.join(__dirname, '../package.json');
  const transform = require('app-builder-lib/out/fileTransformer').createTransformer(path.dirname(pkgFile), {}, null);
  const packaged = JSON.parse(await transform(pkgFile));
  assert.equal(packaged.build, undefined, 'the real packager strips build configuration');
  let requested;
  assert.equal(hasConfiguredUpdateFeed({ isPackaged: true, resourcesPath: '/app/resources', packageInfo: packaged,
    existsSync: (file) => { requested = file; return true; } }), true);
  assert.equal(requested, path.join('/app/resources', 'app-update.yml'));
  assert.equal(hasConfiguredUpdateFeed({ isPackaged: true, resourcesPath: '/app/resources', packageInfo: require('../package.json'), existsSync: () => false }), false);
});
function harness({ packaged = true, feed = true } = {}) {
  const dialogs = [], logs = [], updater = new EventEmitter();
  let checks = 0, installs = 0;
  updater.checkForUpdates = async () => { checks++; return { updateInfo: { version: '0.1.26' } }; };
  updater.quitAndInstall = () => installs++;
  const context = { AUTO_UPDATE_FEED_CONFIGURED: feed, autoUpdater: updater,
    app: { isPackaged: packaged, isReady: () => false, getVersion: () => '0.1.26' },
    mainWindow: null, dialog: { showMessageBox: async (_parent, info) => { dialogs.push(info); return { response: 0 }; } },
    stopDevServer() {}, console: { log: (...args) => logs.push(args), warn() {} },
    setInterval: () => 1, clearInterval() {}, fs, path,
  };
  vm.createContext(context); vm.runInContext(code, context);
  return { context, updater, dialogs, logs, counts: () => ({ checks, installs }) };
}
test('manual update check answers when already current', async () => {
  const h = harness(); h.context.registerAutoUpdaterEvents(); await h.context.checkForUpdatesFromMenu();
  assert.match(h.dialogs[0].message, /latest version/); assert.equal(h.counts().checks, 1);
  assert.equal(h.updater.allowPrerelease, false); assert.equal(h.updater.allowDowngrade, false);
});
test('manual update downloads and then offers restart/install', async () => {
  const h = harness(); h.context.registerAutoUpdaterEvents();
  h.updater.checkForUpdates = async () => ({ updateInfo: { version: '0.1.27' }, downloadPromise: Promise.resolve() });
  await h.context.checkForUpdatesFromMenu(); assert.match(h.dialogs[0].message, /0.1.27 is downloading/);
  h.updater.emit('update-downloaded', { version: '0.1.27' }); await new Promise((resolve) => setImmediate(resolve));
  assert.equal(h.dialogs[1].buttons[0], 'Restart Now'); assert.equal(h.counts().installs, 1);
});
test('network failures report an error and allow another manual attempt', async () => {
  const h = harness(); h.updater.checkForUpdates = async () => { throw new Error('offline'); };
  await h.context.checkForUpdatesFromMenu(); await h.context.checkForUpdatesFromMenu();
  assert.equal(h.dialogs.length, 2); assert.ok(h.dialogs.every((d) => d.type === 'warning'));
});
test('download promise failures are consumed and logged', async () => {
  const h = harness(); h.context.registerAutoUpdaterEvents();
  h.updater.checkForUpdates = async () => ({ updateInfo: { version: '0.1.27' }, downloadPromise: Promise.reject(new Error('download failed')) });
  await h.context.checkForUpdatesFromMenu(); await Promise.resolve();
  assert.ok(h.logs.some((l) => String(l).includes('Update download failed')));
});
test('development and unconfigured builds never contact a feed', async () => {
  for (const opts of [{ packaged: false }, { feed: false }]) {
    const h = harness(opts); await h.context.checkForUpdatesFromMenu(); assert.equal(h.counts().checks, 0);
  }
});
