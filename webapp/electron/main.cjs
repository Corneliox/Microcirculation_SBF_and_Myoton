const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow = null;
let activePythonProcess = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function getPythonExecutablePath() {
  if (isDev) {
    return process.platform === 'win32' ? 'python' : 'python3';
  }
  // Packaged app path: resources/backend/analyzer/analyzer.exe
  const packagedExe = path.join(process.resourcesPath, 'backend', 'analyzer', 'analyzer.exe');
  if (fs.existsSync(packagedExe)) {
    return packagedExe;
  }
  return process.platform === 'win32' ? 'python' : 'python3';
}

function getAnalyzerScriptPath() {
  if (isDev) {
    return path.join(__dirname, '../../backend/analyzer_cli.py');
  }
  return path.join(process.resourcesPath, 'backend', 'analyzer_cli.py');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 1080,
    minHeight: 700,
    title: "Microcirculation (SBF) & Myoton Research Suite",
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  if (isDev) {
    const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (activePythonProcess) {
      try {
        activePythonProcess.kill();
      } catch (e) {}
      activePythonProcess = null;
    }
  });
}

// -------------------------------------------------------------
// IPC Handlers
// -------------------------------------------------------------

ipcMain.handle('get-platform-info', async () => {
  return {
    platform: process.platform,
    isElectron: true,
    appVersion: app.getVersion(),
    pythonExe: getPythonExecutablePath(),
    isDev: isDev
  };
});

ipcMain.handle('select-file', async (event, options = {}) => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: options.title || 'Pilih File Data Excel',
    filters: options.filters || [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }],
    properties: ['openFile']
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('open-external', async (event, url) => {
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    shell.openExternal(url);
  }
});

ipcMain.handle('run-python-analysis', async (event, params) => {
  return new Promise((resolve, reject) => {
    const pythonExe = getPythonExecutablePath();
    const scriptPath = getAnalyzerScriptPath();

    const args = [];
    if (isDev || !pythonExe.endsWith('.exe') || pythonExe.endsWith('python.exe')) {
      args.push(scriptPath);
    }

    args.push('--task', params.task || 'protocol_b_grid');
    if (params.microFile) args.push('--micro-file', params.microFile);
    if (params.myotonFile) args.push('--myoton-file', params.myotonFile);
    if (params.subject) args.push('--subject', params.subject);
    if (params.freq) args.push('--freq', params.freq);
    if (params.fs) args.push('--fs', String(params.fs));
    if (params.dwellDuration) args.push('--dwell-duration', String(params.dwellDuration));
    if (params.estimator) args.push('--estimator', params.estimator);

    console.log('[Electron IPC] Spawning Python:', pythonExe, args.join(' '));

    const py = spawn(pythonExe, args, {
      windowsHide: true
    });

    activePythonProcess = py;

    let stdoutData = '';
    let stderrData = '';

    py.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString();
    });

    py.stderr.on('data', (chunk) => {
      stderrData += chunk.toString();
    });

    py.on('error', (err) => {
      activePythonProcess = null;
      console.error('[Electron IPC] Python Spawn Error:', err);
      reject(new Error(`Gagal menjalankan Python backend: ${err.message}`));
    });

    py.on('close', (code) => {
      activePythonProcess = null;
      if (code !== 0) {
        console.error('[Electron IPC] Python Exit Error Code:', code, stderrData);
        reject(new Error(`Python process exited with code ${code}: ${stderrData || stdoutData}`));
        return;
      }

      try {
        const parsed = JSON.parse(stdoutData.trim());
        resolve(parsed);
      } catch (parseErr) {
        console.error('[Electron IPC] JSON Parse Error:', parseErr, stdoutData);
        reject(new Error(`Gagal mengurai respons JSON dari Python backend: ${parseErr.message}`));
      }
    });
  });
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
