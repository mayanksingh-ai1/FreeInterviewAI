import { contextBridge, ipcRenderer } from 'electron';

export interface SystemInfo {
  platform: string;
  arch: string;
  memoryTotalGB: number;
  memoryFreeGB: number;
  cpus: number;
}

export interface LocalAIStatus {
  engine: string;
  status: 'ready' | 'starting' | 'offline';
  model: string;
  mock: boolean;
}

export interface AnswerWindowStatus {
  isOpen: boolean;
  isAlwaysOnTop: boolean;
}

export interface ElectronAPI {
  getAppVersion: () => Promise<string>;
  getSystemInfo: () => Promise<SystemInfo>;
  checkMicrophonePermission: () => Promise<string>;
  getLocalAIStatus: () => Promise<LocalAIStatus>;
  openExternal: (url: string) => Promise<void>;
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;
  // Phase 3 Answer Window API
  openAnswerWindow: () => Promise<boolean>;
  closeAnswerWindow: () => Promise<boolean>;
  toggleAnswerWindowAlwaysOnTop: (enabled: boolean) => Promise<boolean>;
  getAnswerWindowStatus: () => Promise<AnswerWindowStatus>;
  sendToAnswerWindow: (payload: any) => Promise<boolean>;
  onAnswerWindowData: (callback: (payload: any) => void) => () => void;
}

const electronAPI: ElectronAPI = {
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),
  getSystemInfo: () => ipcRenderer.invoke('system:get-info'),
  checkMicrophonePermission: () => ipcRenderer.invoke('media:check-mic'),
  getLocalAIStatus: () => ipcRenderer.invoke('ai:get-status'),
  openExternal: (url: string) => ipcRenderer.invoke('app:open-external', url),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  // Phase 3 restricted bridge
  openAnswerWindow: () => ipcRenderer.invoke('answer-window:open'),
  closeAnswerWindow: () => ipcRenderer.invoke('answer-window:close'),
  toggleAnswerWindowAlwaysOnTop: (enabled: boolean) => ipcRenderer.invoke('answer-window:toggle-always-on-top', enabled),
  getAnswerWindowStatus: () => ipcRenderer.invoke('answer-window:get-status'),
  sendToAnswerWindow: (payload: any) => ipcRenderer.invoke('answer-window:send-data', payload),
  onAnswerWindowData: (callback: (payload: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('answer-window:data', handler);
    return () => {
      ipcRenderer.removeListener('answer-window:data', handler);
    };
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
