import { app, BrowserWindow, ipcMain, shell } from 'electron';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

let mainWindow: BrowserWindow | null = null;
let answerWindow: BrowserWindow | null = null;
let cachedAnswerPayload: any = null;

const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1260,
    height: 840,
    minWidth: 1024,
    minHeight: 700,
    title: 'FreeInterviewAI',
    backgroundColor: '#090d16',
    autoHideMenuBar: true,
    show: false, // Prevents white flash
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    console.log('[FreeInterviewAI] Main window ready and shown');
    if (process.env.TEST_EXIT === '1') {
      setTimeout(() => {
        console.log('[FreeInterviewAI] TEST_EXIT detected, closing window...');
        mainWindow?.close();
        answerWindow?.close();
        app.quit();
      }, 1500);
    }
  });

  // Handle external navigation safely
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  const distHtmlPath = path.join(__dirname, '../dist/index.html');

  if (isDev) {
    const devServerUrl = 'http://localhost:5173';
    mainWindow.loadURL(devServerUrl);
  } else if (fs.existsSync(distHtmlPath)) {
    mainWindow.loadFile(distHtmlPath);
  } else {
    mainWindow.loadURL('http://localhost:5173');
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (answerWindow) {
      answerWindow.close();
      answerWindow = null;
    }
  });
}

function createAnswerWindow() {
  if (answerWindow) {
    answerWindow.show();
    answerWindow.focus();
    return answerWindow;
  }

  answerWindow = new BrowserWindow({
    width: 540,
    height: 750,
    minWidth: 380,
    minHeight: 450,
    title: 'FreeInterviewAI - Dedicated Answer Panel',
    backgroundColor: '#090d16',
    autoHideMenuBar: true,
    resizable: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  answerWindow.once('ready-to-show', () => {
    answerWindow?.show();
    console.log('[FreeInterviewAI] Dedicated Answer Window ready and shown');
    if (cachedAnswerPayload) {
      answerWindow?.webContents.send('answer-window:data', cachedAnswerPayload);
    }
  });

  answerWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  const distHtmlPath = path.join(__dirname, '../dist/index.html');

  if (isDev) {
    answerWindow.loadURL('http://localhost:5173/#answer-window');
  } else if (fs.existsSync(distHtmlPath)) {
    answerWindow.loadFile(distHtmlPath, { hash: 'answer-window' });
  } else {
    answerWindow.loadURL('http://localhost:5173/#answer-window');
  }

  answerWindow.on('closed', () => {
    answerWindow = null;
  });

  return answerWindow;
}

// IPC Handlers
ipcMain.handle('app:get-version', () => {
  return app.getVersion();
});

ipcMain.handle('system:get-info', () => {
  const totalMem = os.totalmem() / (1024 * 1024 * 1024);
  const freeMem = os.freemem() / (1024 * 1024 * 1024);
  return {
    platform: os.platform(),
    arch: os.arch(),
    memoryTotalGB: Number(totalMem.toFixed(1)),
    memoryFreeGB: Number(freeMem.toFixed(1)),
    cpus: os.cpus().length,
  };
});

ipcMain.handle('media:check-mic', async () => {
  return 'granted';
});

ipcMain.handle('ai:get-status', async () => {
  return {
    engine: 'FastAPI Backend (:8000)',
    status: 'ready',
    model: 'llama3.2:1b',
    mock: false,
  };
});

ipcMain.handle('app:open-external', async (_event, targetUrl: string) => {
  if (typeof targetUrl === 'string' && (targetUrl.startsWith('http://') || targetUrl.startsWith('https://'))) {
    await shell.openExternal(targetUrl);
  }
});

// Phase 3 Answer Window IPC Handlers
ipcMain.handle('answer-window:open', () => {
  createAnswerWindow();
  return true;
});

ipcMain.handle('answer-window:close', () => {
  if (answerWindow) {
    answerWindow.close();
    answerWindow = null;
  }
  return true;
});

ipcMain.handle('answer-window:toggle-always-on-top', (_event, enabled: boolean) => {
  if (answerWindow) {
    answerWindow.setAlwaysOnTop(enabled);
    return answerWindow.isAlwaysOnTop();
  }
  return false;
});

ipcMain.handle('answer-window:get-status', () => {
  return {
    isOpen: !!answerWindow,
    isAlwaysOnTop: answerWindow?.isAlwaysOnTop() ?? false,
  };
});

ipcMain.handle('answer-window:send-data', (_event, payload: any) => {
  cachedAnswerPayload = payload;
  if (answerWindow) {
    answerWindow.webContents.send('answer-window:data', payload);
  }
  return true;
});

ipcMain.on('window:minimize', () => {
  mainWindow?.minimize();
});

ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.on('window:close', () => {
  mainWindow?.close();
});

// App Lifecycle
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
