import React, { useState } from 'react';
import { VideoItem } from '../types';
import { Camera, Clock, Play, Maximize2, Sparkles } from 'lucide-react';

interface VideoSnapshotFrameProps {
  video?: VideoItem;
  timestamp: number;
  altText?: string;
  className?: string;
}

export const VideoSnapshotFrame: React.FC<VideoSnapshotFrameProps> = ({
  video,
  timestamp,
  altText = 'Ảnh chụp từ đoạn video gốc',
  className = '',
}) => {
  const [imgError, setImgError] = useState(false);
  const [showLiveFrame, setShowLiveFrame] = useState(false);

  const youtubeId = video?.youtubeId;
  const startSecond = Math.max(0, Math.floor(timestamp || 0));

  const formatSec = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!youtubeId) {
    return (
      <div className={`p-6 rounded-xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center text-slate-500 text-xs ${className}`}>
        <Camera className="w-8 h-8 mb-2 text-slate-600" />
        <span>Không tìm thấy video gốc</span>
      </div>
    );
  }

  // YouTube thumbnail URL
  const thumbnailUrl = imgError
    ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`
    : `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;

  return (
    <div className={`relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-md group ${className}`}>
      {showLiveFrame ? (
        // Live paused iframe frame at exact timestamp
        <div className="relative aspect-video w-full bg-black">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${youtubeId}?start=${startSecond}&autoplay=1&controls=1&rel=0&modestbranding=1`}
            title={altText}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
          <button
            onClick={() => setShowLiveFrame(false)}
            className="absolute top-2 right-2 px-2 py-1 bg-slate-950/80 hover:bg-slate-900 text-slate-300 text-[10px] font-mono rounded border border-slate-700 backdrop-blur-sm cursor-pointer z-10"
          >
            Đóng video
          </button>
        </div>
      ) : (
        // High-definition Snapshot Card
        <div className="relative aspect-video w-full overflow-hidden bg-slate-950">
          <img
            src={thumbnailUrl}
            alt={altText}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />

          {/* Dark gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent pointer-events-none" />

          {/* Top badge: Snapshot label & Timecode */}
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-950/85 backdrop-blur-md border border-slate-800 text-[11px] font-mono text-amber-300 shadow">
            <Camera className="w-3 h-3 text-amber-400" />
            <span>Ảnh trích xuất đoạn: {formatSec(startSecond)}</span>
          </div>

          {/* Action button to open live frame */}
          <button
            onClick={() => setShowLiveFrame(true)}
            className="absolute bottom-2.5 right-2.5 px-3 py-1.5 rounded-lg bg-slate-950/90 hover:bg-amber-400 hover:text-slate-950 text-slate-200 text-xs font-semibold backdrop-blur-md border border-slate-700/80 transition-all flex items-center gap-1.5 cursor-pointer shadow-lg active:scale-95"
            title="Mở đoạn video gốc tại giây này"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Xem đoạn video ({formatSec(startSecond)})</span>
          </button>

          {/* Bottom title info */}
          {video?.title && (
            <div className="absolute bottom-2.5 left-2.5 max-w-[65%] truncate text-[11px] text-slate-300 font-medium drop-shadow">
              {video.title}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
