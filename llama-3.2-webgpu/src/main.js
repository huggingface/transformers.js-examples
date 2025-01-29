import { app, BrowserWindow, Tray, Menu } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn } from 'child_process';
import treeKill from 'tree-kill';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow = null;
let tray = null;
let viteProcess = null;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 480,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('control.html');
};

const startViteServer = () => {
  viteProcess = spawn('npm', ['run', 'dev'], {
    shell: true,
    stdio: 'ignore',
    windowsHide: true
  });
  
  // 等待vite服務器啟動
  return new Promise((resolve) => {
    setTimeout(resolve, 5178);
  });
};

const killViteServer = () => {
  if (viteProcess && viteProcess.pid) {
    treeKill(viteProcess.pid);
    viteProcess = null;
  }
};

const createTray = () => {
  tray = new Tray(join(__dirname, '../public/logo.png'));
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '開啟控制介面',
      click: async () => {
        if (mainWindow === null) {
          if (!viteProcess) {
            await startViteServer();
          }
          createWindow();
        } else {
          mainWindow.show();
        }
      }
    },
    {
      label: '退出',
      click: () => {
        killViteServer();
        app.quit();
      }
    }
  ]);
  tray.setToolTip('Llama 3.2 WebGPU Service');
  tray.setContextMenu(contextMenu);
};

app.whenReady().then(async () => {
  await startViteServer();
  createTray();
  createWindow();
});

app.on('window-all-closed', () => {
  killViteServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    if (!viteProcess) {
      await startViteServer();
    }
    createWindow();
  }
});

app.on('before-quit', () => {
  killViteServer();
});
