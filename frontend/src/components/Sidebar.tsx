import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useUser } from '../lib/userContext';
import { useComputeMode } from '../lib/ComputeModeContext.jsx';

export type ModuleKey = 'dq' | 'li' | 'vs';

interface SidebarProps {
  activeModule: ModuleKey;
  onModuleChange: (module: ModuleKey) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeModule, onModuleChange }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useUser();
  const { isLocalMode } = useComputeMode();
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

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
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

      </nav>
    
      {isLocalMode && (
        <div className="px-4 pb-2">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2 py-1 text-[11px] font-semibold text-emerald-200">
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 11V7a4.5 4.5 0 10-9 0v4m-2 0h13a2 2 0 012 2v6a2 2 0 01-2 2h-13a2 2 0 01-2-2v-6a2 2 0 012-2z"
              />
            </svg>
            Local
          </div>
        </div>
      )}

      <div className="px-4 py-4 border-t border-slate-800 space-y-3">
        <div className="text-xs text-slate-400">
          <p>Signed in as</p>
          <p className="font-medium text-slate-200 truncate">{user?.email}</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/profile')}
          className="w-full px-3 py-2 rounded-md font-medium transition-colors text-left text-sm text-slate-300 hover:bg-slate-800 hover:text-white bg-slate-800/40"
        >
          Profile
        </button>
        <button
          type="button"
          onClick={handleLogout}
          className="w-full px-3 py-2 rounded-md font-medium transition-colors text-left text-sm text-slate-300 hover:bg-slate-800 hover:text-white bg-slate-800/40"
        >
          Sign Out
        </button>
      </div>
      <div className="p-4 border-t border-slate-800 text-sm text-slate-500">
        &copy; SpectraCast Suite
      </div>
    </aside>
  );
};
