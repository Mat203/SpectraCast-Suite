import React from 'react';

export type ModuleKey = 'dq' | 'li';

interface SidebarProps {
  activeModule: ModuleKey;
  onModuleChange: (module: ModuleKey) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeModule, onModuleChange }) => {
  const navItemClass = (isActive: boolean) =>
    `w-full px-3 py-2 rounded-md font-medium transition-colors text-left ${
      isActive
        ? 'bg-indigo-600 text-white'
        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
    }`;

  return (
    <aside className="w-64 h-full bg-slate-900 text-slate-300 flex flex-col flex-shrink-0">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-white tracking-wide">SpectraCast</h1>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-2">
        <button
          type="button"
          className={navItemClass(activeModule === 'dq')}
          onClick={() => onModuleChange('dq')}
        >
          Data Quality
        </button>

        <div className="px-3 py-2 text-slate-500 rounded-md font-medium cursor-not-allowed flex justify-between items-center group relative" title="Coming Soon">
          Visual Standardizer
          <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded-full text-slate-400">Soon</span>
        </div>

        <button
          type="button"
          className={navItemClass(activeModule === 'li')}
          onClick={() => onModuleChange('li')}
        >
          Leading Indicators
        </button>
      </nav>

      <div className="p-4 border-t border-slate-800 text-sm text-slate-500">
        &copy; SpectraCast Suite
      </div>
    </aside>
  );
};
