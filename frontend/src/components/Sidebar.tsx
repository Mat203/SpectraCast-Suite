import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export type ModuleKey = 'dq' | 'li' | 'vs';

interface SidebarProps {
  activeModule: ModuleKey;
  onModuleChange: (module: ModuleKey) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeModule, onModuleChange }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isProfileRoute = location.pathname.startsWith('/profile');

  const navItemClass = (isActive: boolean) =>
    `w-full px-3 py-2 rounded-md font-medium transition-colors text-left flex justify-between items-center ${
      isActive
        ? 'bg-indigo-600 text-white'
        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
    }`;

  const handleModuleClick = (module: ModuleKey) => {
    onModuleChange(module);
    navigate('/app');
  };

  return (
    <aside className="w-64 h-full bg-slate-900 text-slate-300 flex flex-col flex-shrink-0">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-white tracking-wide">SpectraCast</h1>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-2">
        <button
          type="button"
          className={navItemClass(!isProfileRoute && activeModule === 'dq')}
          onClick={() => handleModuleClick('dq')}
        >
          Data Quality
        </button>

        <button
          type="button"
          className={navItemClass(!isProfileRoute && activeModule === 'vs')}
          onClick={() => handleModuleClick('vs')}
        >
          Visual Standardizer
        </button>

        <button
          type="button"
          className={navItemClass(!isProfileRoute && activeModule === 'li')}
          onClick={() => handleModuleClick('li')}
        >
          Leading Indicators
        </button>

        <button
          type="button"
          className={navItemClass(isProfileRoute)}
          onClick={() => navigate('/profile')}
        >
          Profile
        </button>
      </nav>

      <div className="p-4 border-t border-slate-800 text-sm text-slate-500">
        &copy; SpectraCast Suite
      </div>
    </aside>
  );
};
