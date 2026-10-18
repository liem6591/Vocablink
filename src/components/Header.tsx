import React from 'react';
import { Sparkles, BookOpen, Clock, Youtube, Network, BarChart3 } from 'lucide-react';

export type NavTab = 'explore' | 'dashboard' | 'graph' | 'admin' | 'vocab_srs' | 'video_srs';

interface HeaderProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  vocabDueCount: number;
  videoDueCount: number;
  onOpenImport: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  vocabDueCount,
  videoDueCount,
  onOpenImport,
}) => {
  return (
    <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Single text element wordmark in display face */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onTabChange('explore')}
            className="text-left group flex items-center gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center shadow-sm">
              <span className="text-white font-black text-sm tracking-tighter">VL</span>
            </div>
            <span className="text-lg font-bold tracking-tight text-white font-['Plus_Jakarta_Sans'] group-hover:text-amber-400 transition-colors">
              Vocablink
            </span>
          </button>
        </div>

        {/* Zone 2: Navigation links */}
        <nav className="hidden md:flex items-center gap-5 text-sm font-medium text-slate-400">
          <button
            onClick={() => onTabChange('explore')}
            className={`transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'explore'
                ? 'text-amber-400 font-semibold border-b-2 border-amber-400 pb-0.5'
                : 'hover:text-slate-200'
            }`}
          >
            Thư viện Video
          </button>

          <button
            onClick={() => onTabChange('dashboard')}
            className={`transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'dashboard'
                ? 'text-amber-400 font-semibold border-b-2 border-amber-400 pb-0.5'
                : 'hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-amber-400" />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => onTabChange('graph')}
            className={`transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'graph'
                ? 'text-amber-400 font-semibold border-b-2 border-amber-400 pb-0.5'
                : 'hover:text-slate-200'
            }`}
          >
            <Network className="w-4 h-4 text-amber-400" />
            <span>Graph View</span>
          </button>

          <button
            onClick={() => onTabChange('admin')}
            className={`transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'admin'
                ? 'text-amber-400 font-semibold border-b-2 border-amber-400 pb-0.5'
                : 'hover:text-slate-200'
            }`}
          >
            <Youtube className="w-4 h-4 text-rose-500" />
            <span>Tách Phụ Đề AI</span>
          </button>

          <button
            onClick={() => onTabChange('vocab_srs')}
            className={`transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'vocab_srs'
                ? 'text-amber-400 font-semibold border-b-2 border-amber-400 pb-0.5'
                : 'hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4 text-emerald-400" />
            <span>Sổ Từ Vựng SRS</span>
            {vocabDueCount > 0 && (
              <span className="text-xs px-1.5 py-0.2 bg-amber-500/20 text-amber-300 font-mono font-bold rounded">
                {vocabDueCount}
              </span>
            )}
          </button>

          <button
            onClick={() => onTabChange('video_srs')}
            className={`transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'video_srs'
                ? 'text-amber-400 font-semibold border-b-2 border-amber-400 pb-0.5'
                : 'hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4 text-indigo-400" />
            <span>Ôn Tập Video SRS</span>
            {videoDueCount > 0 && (
              <span className="text-xs px-1.5 py-0.2 bg-indigo-500/20 text-indigo-300 font-mono font-bold rounded">
                {videoDueCount}
              </span>
            )}
          </button>
        </nav>

        {/* Zone 3: 1-2 primary actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenImport}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors whitespace-nowrap shadow-sm active:scale-95 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-slate-950" />
            <span>+ Nhập Short YouTube</span>
          </button>
        </div>
      </div>

      {/* Mobile nav bar */}
      <div className="md:hidden flex items-center justify-around border-t border-slate-900 bg-slate-950/95 py-2 px-2 text-xs">
        <button
          onClick={() => onTabChange('explore')}
          className={`px-2 py-1 rounded cursor-pointer ${activeTab === 'explore' ? 'text-amber-400 font-bold' : 'text-slate-400'}`}
        >
          Thư viện
        </button>
        <button
          onClick={() => onTabChange('dashboard')}
          className={`px-2 py-1 rounded cursor-pointer ${activeTab === 'dashboard' ? 'text-amber-400 font-bold' : 'text-slate-400'}`}
        >
          Dashboard
        </button>
        <button
          onClick={() => onTabChange('graph')}
          className={`px-2 py-1 rounded cursor-pointer ${activeTab === 'graph' ? 'text-amber-400 font-bold' : 'text-slate-400'}`}
        >
          Graph
        </button>
        <button
          onClick={() => onTabChange('admin')}
          className={`px-2 py-1 rounded cursor-pointer ${activeTab === 'admin' ? 'text-amber-400 font-bold' : 'text-slate-400'}`}
        >
          Tách Sub
        </button>
        <button
          onClick={() => onTabChange('vocab_srs')}
          className={`px-2 py-1 rounded relative cursor-pointer ${activeTab === 'vocab_srs' ? 'text-amber-400 font-bold' : 'text-slate-400'}`}
        >
          Từ ({vocabDueCount})
        </button>
        <button
          onClick={() => onTabChange('video_srs')}
          className={`px-2 py-1 rounded relative cursor-pointer ${activeTab === 'video_srs' ? 'text-amber-400 font-bold' : 'text-slate-400'}`}
        >
          Ôn ({videoDueCount})
        </button>
      </div>
    </header>
  );
};
