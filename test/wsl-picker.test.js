const test = require('node:test');
const assert = require('node:assert/strict');
const { openWslProject, parseDistributions } = require('../electron/wslPicker');

test('parses UTF-16 WSL names without losing Unicode', () => {
  assert.deepEqual(parseDistributions(Buffer.from('\uFEFFUbuntu\r\nDebian\r\n', 'utf16le')), ['Ubuntu', 'Debian']);
});

test('opens directly in selected distribution home and returns project', async () => {
  const project = String.raw`\\wsl.localhost\Debian\home\lee\site`;
  const calls = [];
  const result = await openWslProject({
    run: async (_cmd, args) => {
      calls.push(args);
      return { stdout: args[0] === '--list' ? Buffer.from('Ubuntu\r\nDebian\r\n', 'utf16le') : '/home/lee' };
    },
    isAstroProject: () => true,
    dialog: {
      showMessageBox: async () => ({ response: 1 }),
      showOpenDialog: async (_parent, options) => {
        assert.equal(options.defaultPath, String.raw`\\wsl.localhost\Debian\home\lee`);
        return { canceled: false, filePaths: [project] };
      },
    },
  });
  assert.equal(calls[1][1], 'Debian');
  assert.equal(result.projectPath, project);
});

test('cancel does not launch a distribution or folder dialog', async () => {
  const result = await openWslProject({
    run: async () => ({ stdout: 'Ubuntu\nDebian' }),
    dialog: { showMessageBox: async () => ({ response: 2 }) },
  });
  assert.deepEqual(result, { canceled: true });
});

test('WSL unavailable is returned as a user-visible error', async () => {
  const result = await openWslProject({ run: async () => { throw new Error('WSL unavailable'); } });
  assert.match(result.error, /WSL unavailable/);
});
