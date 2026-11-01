import React, { useState, useEffect } from 'react';
import { MainLayout } from './components/layout/MainLayout';
import { DashboardView } from './views/DashboardView';
import { AIChatView } from './views/AIChatView';
import { InterviewPracticeView } from './views/InterviewPracticeView';
import { CodingAssistantView } from './views/CodingAssistantView';
import { ResumeAnalyzerView } from './views/ResumeAnalyzerView';
import { QuestionBankView } from './views/QuestionBankView';
import { HistoryView } from './views/HistoryView';
import { SettingsView } from './views/SettingsView';
import { DedicatedAnswerWindowView } from './views/DedicatedAnswerWindowView';

import {
  NavigationTab,
  SystemInfoData,
  LocalAIStatusData,
  AppSettings,
  InterviewSession,
} from './types';

import {
  MOCK_FEATURES,
  MOCK_RECENT_SESSIONS,
  INITIAL_SETTINGS,
} from './mocks/mockData';
import { aiService } from './services/aiService';

export const App: React.FC = () => {
  // Check if running inside the secondary answer window
  const isAnswerWindow = typeof window !== 'undefined' && window.location.hash === '#answer-window';

  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const [systemInfo, setSystemInfo] = useState<SystemInfoData | null>(null);
  const [aiStatus, setAiStatus] = useState<LocalAIStatusData | null>(null);
  const [micStatus, setMicStatus] = useState<string>('granted');
  const [appVersion, setAppVersion] = useState<string>('0.3.0');
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const savedTheme = localStorage.getItem('freeinterview_theme') as AppSettings['theme'];
      if (savedTheme) {
        return { ...INITIAL_SETTINGS, theme: savedTheme };
      }
    } catch {}
    return INITIAL_SETTINGS;
  });
  const [recentSessions, setRecentSessions] = useState<InterviewSession[]>(MOCK_RECENT_SESSIONS);

  // Apply theme dynamically to documentElement
  useEffect(() => {
    const currentTheme = settings.theme || 'dark-slate';
    document.documentElement.setAttribute('data-theme', currentTheme);
    if (currentTheme === 'light') {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    }
    try {
      localStorage.setItem('freeinterview_theme', currentTheme);
    } catch {}
  }, [settings.theme]);

  const fetchTelemetry = async () => {
    // 1. Check Python FastAPI backend & Ollama health
    const health = await aiService.checkHealth();

    if (health.online && health.data) {
      setAiStatus({
        engine: health.data.ollama_connected
          ? `FastAPI + Ollama (${health.data.active_model})`
          : 'FastAPI Online (Ollama Offline - Mock Fallback)',
        status: health.data.ollama_connected ? 'ready' : 'offline',
        model: health.data.active_model || 'llama3.2:1b',
        mock: !health.data.ollama_connected,
        ollamaRunning: health.data.ollama_connected,
        backendOnline: true,
      });
    } else {
      setAiStatus({
        engine: 'FastAPI Backend Offline (:8000 unreachable)',
        status: 'offline',
        model: settings.modelName,
        mock: true,
        ollamaRunning: false,
        backendOnline: false,
      });
    }

    // 2. Query system info via Electron IPC
    if (window.electronAPI) {
      try {
        const [ver, sys, mic] = await Promise.all([
          window.electronAPI.getAppVersion().catch(() => '0.3.0'),
          window.electronAPI.getSystemInfo().catch(() => null),
          window.electronAPI.checkMicrophonePermission().catch(() => 'granted'),
        ]);

        if (ver) setAppVersion(ver);
        if (sys) setSystemInfo(sys);
        if (mic) setMicStatus(mic);
      } catch (err) {
        console.warn('Electron IPC bridge error:', err);
      }
    } else {
      // Browser preview fallback
      setSystemInfo({
        platform: 'win32',
        arch: 'x64',
        memoryTotalGB: 8.0,
        memoryFreeGB: 4.6,
        cpus: 8,
      });
    }
  };

  useEffect(() => {
    fetchTelemetry();
    const timer = setInterval(fetchTelemetry, 3000);
    return () => clearInterval(timer);
  }, []);

  // If this window was launched specifically for the dedicated answer panel
  if (isAnswerWindow) {
    return <DedicatedAnswerWindowView />;
  }

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardView
            features={MOCK_FEATURES}
            recentSessions={recentSessions}
            systemInfo={systemInfo}
            aiStatus={aiStatus}
            micStatus={micStatus}
            onNavigate={(tab) => setActiveTab(tab)}
            onRefreshTelemetry={fetchTelemetry}
          />
        );
      case 'ai-chat':
        return <AIChatView />;
      case 'interview-practice':
        return (
          <InterviewPracticeView
            onSaveToHistory={(newSession) =>
              setRecentSessions((prev) => [newSession, ...prev])
            }
          />
        );
      case 'coding-assistant':
        return <CodingAssistantView />;
      case 'resume-analyzer':
        return <ResumeAnalyzerView />;
      case 'question-bank':
        return <QuestionBankView />;
      case 'history':
        return <HistoryView />;
      case 'settings':
        return (
          <SettingsView
            settings={settings}
            systemInfo={systemInfo}
            onSaveSettings={(newSettings) => setSettings(newSettings)}
          />
        );
      default:
        return (
          <DashboardView
            features={MOCK_FEATURES}
            recentSessions={recentSessions}
            systemInfo={systemInfo}
            aiStatus={aiStatus}
            micStatus={micStatus}
            onNavigate={(tab) => setActiveTab(tab)}
            onRefreshTelemetry={fetchTelemetry}
          />
        );
    }
  };

  return (
    <MainLayout
      activeTab={activeTab}
      onSelectTab={(tab) => setActiveTab(tab)}
      aiStatus={aiStatus}
      systemInfo={systemInfo}
      appVersion={appVersion}
    >
      {renderActiveView()}
    </MainLayout>
  );
};

export default App;
