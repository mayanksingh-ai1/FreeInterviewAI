import React from 'react';
import { Sidebar } from './Sidebar';
import { TopHeader } from './TopHeader';
import { NavigationTab, LocalAIStatusData, SystemInfoData } from '../../types';

interface MainLayoutProps {
  children: React.ReactNode;
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  aiStatus: LocalAIStatusData | null;
  systemInfo: SystemInfoData | null;
  appVersion: string;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  activeTab,
  onSelectTab,
  aiStatus,
  systemInfo,
  appVersion,
}) => {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface-950 font-sans">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={onSelectTab}
        systemMemory={
          systemInfo
            ? { total: systemInfo.memoryTotalGB, free: systemInfo.memoryFreeGB }
            : undefined
        }
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopHeader
          activeTab={activeTab}
          aiStatus={aiStatus}
          appVersion={appVersion}
        />
        <main className="flex-1 overflow-y-auto p-6 bg-surface-950">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
