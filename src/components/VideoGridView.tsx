import React, { useState } from 'react';
import { VideoItem, CEFRLevel } from '../types';
import { Play, Sparkles, Clock, Search, BookOpen, Plus, Check, Network, BarChart3 } from 'lucide-react';
import heroImage from '../assets/images/hero_comprehensible_input_1790773503622.jpg';

interface VideoGridViewProps {
  videos: VideoItem[];
  onSelectVideo: (video: VideoItem) => void;
  onOpenImport: () => void;
  onToggleVideoSRS: (videoId: string) => void;
  onOpenGraph?: () => void;
  onOpenDashboard?: () => void;
}

export const VideoGridView: React.FC<VideoGridViewProps> = ({
  videos,
  onSelectVideo,
  onOpenImport,
  onToggleVideoSRS,
  onOpenGraph,
  onOpenDashboard,
}) => {
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredVideos = videos.filter((video) => {
    const matchesLevel = selectedLevel === 'all' || video.cefrLevel === selectedLevel;
    const matchesSearch =
      video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      video.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
      video.summary.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesLevel && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Hero Banner: Comprehensible Input + SRS Foundation */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="absolute inset-0 z-0">
          <img
            src={heroImage}
            alt="Comprehensible Input Language Learning"
            className="w-full h-full object-cover opacity-25 filter blur-xs"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/90 to-transparent" />
        </div>

        <div className="relative z-10 p-6 sm:p-10 max-w-2xl">
          <div className="flex items-center gap-2 text-xs text-amber-400 font-mono mb-2">
            <span>KRASHEN i+1 COMPREHENSIBLE INPUT</span>
            <span aria-hidden="true">·</span>
            <span>SPACED REPETITION</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-['Plus_Jakarta_Sans'] text-balance">
            Thụ Đắc Tiếng Anh Tự Nhiên Qua YouTube Shorts
          </h1>

          <p className="mt-3 text-sm text-slate-300 leading-relaxed">
            Xem video ngắn thực tế với phụ đề tiếng Anh tương tác đồng bộ thời gian (timestamps), phân tích độ khó CEFR tức thì và lưu từ vựng then chốt vào thuật toán lặp lại ngắt quãng (SRS) để ghi nhớ vĩnh viễn.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={onOpenImport}
              className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-lg transition-colors flex items-center gap-2 shadow-md cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-slate-950" />
              <span>+ Nhập Short Mới Bằng AI</span>
            </button>

            {onOpenDashboard && (
              <button
                onClick={onOpenDashboard}
                className="px-4 py-2.5 bg-slate-900/90 hover:bg-slate-800 text-amber-300 font-semibold text-xs rounded-lg border border-amber-500/30 transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <BarChart3 className="w-4 h-4 text-amber-400" />
                <span>Thống Kê (Dashboard)</span>
              </button>
            )}

            {onOpenGraph && (
              <button
                onClick={onOpenGraph}
                className="px-4 py-2.5 bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white font-semibold text-xs rounded-lg border border-slate-700 transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <Network className="w-4 h-4 text-amber-400" />
                <span>Mạng Đồ Thị (Graph)</span>
              </button>
            )}

            {videos.length > 0 && (
              <button
                onClick={() => onSelectVideo(videos[0])}
                className="px-4 py-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-lg border border-slate-700 transition-colors flex items-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-slate-200" />
                <span>Xem Ngay Video Đề Xuất</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* CEFR Level filter buttons */}
        <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl text-xs overflow-x-auto w-full sm:w-auto">
          {['all', 'A1', 'A2', 'B1', 'B2'].map((lvl) => (
            <button
              key={lvl}
              onClick={() => setSelectedLevel(lvl)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap cursor-pointer ${
                selectedLevel === lvl
                  ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {lvl === 'all' ? 'Tất cả trình độ' : `Trình độ ${lvl}`}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo chủ đề, tiêu đề..."
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
          />
        </div>
      </div>

      {/* Video Cards Grid */}
      {filteredVideos.length === 0 ? (
        <div className="py-16 text-center text-slate-500 text-xs bg-slate-900/40 border border-slate-800 rounded-2xl">
          Không tìm thấy video nào phù hợp với bộ lọc hiện tại.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredVideos.map((video) => (
            <div
              key={video.id}
              className="group bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-2xl overflow-hidden transition-all duration-200 flex flex-col justify-between hover:shadow-xl hover:-translate-y-0.5"
            >
              <div>
                {/* Thumbnail */}
                <div
                  onClick={() => onSelectVideo(video)}
                  className="relative aspect-video bg-slate-950 cursor-pointer overflow-hidden"
                >
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all transform scale-90 group-hover:scale-100 shadow-lg">
                      <Play className="w-4 h-4 fill-slate-950 translate-x-0.5" />
                    </div>
                  </div>
                  <span className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 text-[10px] text-white font-mono rounded">
                    {video.duration}s
                  </span>
                </div>

                {/* Card Content */}
                <div className="p-4">
                  {/* Clean unboxed metadata with dot separators */}
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1.5 font-mono">
                    <span className="font-bold text-amber-400">{video.cefrLevel}</span>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">{video.channel}</span>
                    <span aria-hidden="true">·</span>
                    <span>{video.subtitles.length} câu sub</span>
                  </div>

                  <h3
                    onClick={() => onSelectVideo(video)}
                    className="text-sm font-bold text-white line-clamp-2 hover:text-amber-300 transition-colors cursor-pointer"
                  >
                    {video.title}
                  </h3>

                  <div className="mt-1 text-xs text-amber-400/90 font-medium line-clamp-1">
                    {video.topic}
                  </div>

                  <p className="mt-2 text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {video.summary}
                  </p>
                </div>
              </div>

              {/* Bottom Card Footer */}
              <div className="p-4 pt-0 border-t border-slate-800/60 mt-2 flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                  <BookOpen className="w-3 h-3 text-emerald-400" />
                  <span>{video.suggestedVocab.length} từ then chốt</span>
                </span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onToggleVideoSRS(video.id)}
                    className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                      video.inSrs
                        ? 'bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                    title={video.inSrs ? 'Đang trong lộ trình SRS Video' : 'Thêm vào Lộ trình Ôn tập Video SRS'}
                  >
                    <Clock className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => onSelectVideo(video)}
                    className="px-3 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    Luyện Tập
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
