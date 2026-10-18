import React, { useState } from 'react';
import { VideoItem } from '../types';
import { isDueForReview, formatRelativeReview } from '../utils/srs';
import {
  Clock,
  CheckCircle,
  Play,
  RotateCcw,
  Sparkles,
  Calendar,
  Layers,
  ChevronRight,
  Plus,
  Volume2,
  Trash2
} from 'lucide-react';

interface VideoSRSViewProps {
  videos: VideoItem[];
  onSelectVideoToPlay: (video: VideoItem, forcedMode?: 'bilingual' | 'hidden' | 'shadowing') => void;
  onToggleVideoSRS: (videoId: string) => void;
  onCompleteVideoStage: (videoId: string, stage: number) => void;
  onBrowseLibrary: () => void;
}

export const VideoSRSView: React.FC<VideoSRSViewProps> = ({
  videos,
  onSelectVideoToPlay,
  onToggleVideoSRS,
  onCompleteVideoStage,
  onBrowseLibrary,
}) => {
  const srsVideos = videos.filter((v) => v.inSrs);
  const dueVideos = srsVideos.filter((v) => isDueForReview(v.srsNextReviewDate));

  const getStageTitle = (stage: number) => {
    switch (stage) {
      case 1:
        return 'Chặng 1: Nghe hiểu toàn diện (Phụ đề tiếng Anh)';
      case 2:
        return 'Chặng 2: Thử thách ẩn phụ đề (Blind Listening)';
      case 3:
        return 'Chặng 3: Luyện nói Shadowing (Nói đuổi)';
      case 4:
      default:
        return 'Chặng 4: Củng cố phản xạ & Tự thuật lại';
    }
  };

  const getStageDesc = (stage: number) => {
    switch (stage) {
      case 1:
        return 'Xem video với phụ đề tiếng Anh, tập trung nắm bắt mạch câu chuyện và cụm từ tự nhiên.';
      case 2:
        return 'Ẩn phụ đề, thử thách đôi tai bắt kịp từng âm tiết và ngữ điệu người bản xứ.';
      case 3:
        return 'Bật chế độ lặp từng câu để nhại lại (shadowing) cùng lúc với người nói.';
      case 4:
      default:
        return 'Ôn tập dài hạn củng cố trực giác ngôn ngữ, thử tóm tắt lại video bằng 2-3 câu.';
    }
  };

  const handleStartReview = (video: VideoItem) => {
    const stage = video.srsStage || 1;
    if (stage === 2) {
      onSelectVideoToPlay(video, 'hidden');
    } else if (stage === 3) {
      onSelectVideoToPlay(video, 'shadowing');
    } else {
      onSelectVideoToPlay(video, 'bilingual');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-xs text-indigo-400 font-mono mb-1">
            <span>SPACED COMPREHENSIBLE INPUT</span>
            <span aria-hidden="true">·</span>
            <span>4-STAGE IMMERSION</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white font-['Plus_Jakarta_Sans']">
            Ôn Tập Video Theo Lặp Lại Ngắt Quãng
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Theo nghiên cứu thụ đắc ngôn ngữ tự nhiên của Stephen Krashen, việc nghe lặp lại cùng một video theo khoảng thời gian giãn cách giúp não bộ chuyển hóa cấu trúc câu từ "hiểu tạm thời" thành "trực giác phản xạ tự nhiên".
          </p>
        </div>

        <button
          onClick={onBrowseLibrary}
          className="px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>+ Thêm Video Vào SRS</span>
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
          <div className="text-xs text-slate-400">Video đến hạn hôm nay</div>
          <div className="text-2xl font-black text-amber-400 font-mono mt-1">{dueVideos.length}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Cần luyện tập theo chặng</div>
        </div>

        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
          <div className="text-xs text-slate-400">Tổng video trong lộ trình SRS</div>
          <div className="text-2xl font-black text-indigo-400 font-mono mt-1">{srsVideos.length}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Tự động giãn cách ôn tập</div>
        </div>

        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
          <div className="text-xs text-slate-400">Phương pháp 4 chặng</div>
          <div className="text-xs font-medium text-slate-200 mt-1">
            Hiểu (1d) → Ẩn Sub (3d) → Shadowing (7d) → Củng cố (14d)
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Tối ưu phản xạ tự nhiên</div>
        </div>
      </div>

      {/* Video List enrolled in SRS */}
      {srsVideos.length === 0 ? (
        <div className="p-8 text-center bg-slate-900/60 border border-slate-800 rounded-2xl">
          <Clock className="w-12 h-12 text-indigo-400 mx-auto mb-3 opacity-60" />
          <h3 className="text-base font-bold text-white">Chưa có video nào trong danh sách Ôn tập Ngắt quãng</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            Khi xem bất kỳ video YouTube Short nào trong thư viện, bạn có thể bấm nút "+ Ôn tập Video theo SRS" để kích hoạt lộ trình lặp lại ngắt quãng 4 giai đoạn.
          </p>
          <button
            onClick={onBrowseLibrary}
            className="mt-4 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-lg transition-colors cursor-pointer"
          >
            Khám Phá Thư Viện Video
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {srsVideos.map((video) => {
            const isDue = isDueForReview(video.srsNextReviewDate);
            const stage = video.srsStage || 1;

            return (
              <div
                key={video.id}
                className={`p-5 rounded-2xl border transition-all ${
                  isDue
                    ? 'bg-slate-900/90 border-amber-500/40 shadow-lg'
                    : 'bg-slate-900/60 border-slate-800'
                }`}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  {/* Left: Video details */}
                  <div className="flex items-start gap-4 flex-1">
                    <div className="relative w-28 aspect-video rounded-lg overflow-hidden bg-slate-950 shrink-0 border border-slate-800">
                      <img
                        src={video.thumbnail}
                        alt={video.title}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <span className="absolute bottom-1 right-1 px-1 py-0.2 bg-black/80 text-[10px] text-white font-mono rounded">
                        {video.duration}s
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span className="font-bold text-amber-400 font-mono">{video.cefrLevel}</span>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">{video.topic}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono text-slate-500">Đã ôn {video.srsRepetition || 0} lần</span>
                      </div>

                      <h3 className="text-base font-bold text-white line-clamp-1 mt-0.5">{video.title}</h3>

                      {/* Current Stage Indicator */}
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
                          {getStageTitle(stage)}
                        </span>
                        {isDue && (
                          <span className="text-xs px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 font-bold font-mono">
                            Đến hạn ôn hôm nay
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-400 mt-1 line-clamp-1">{getStageDesc(stage)}</p>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
                    <button
                      onClick={() => handleStartReview(video)}
                      className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Play className="w-3.5 h-3.5 fill-slate-950" />
                      <span>{isDue ? 'Vào Ôn Tập Ngay' : 'Luyện Tập Lại'}</span>
                    </button>

                    <button
                      onClick={() => onCompleteVideoStage(video.id, stage)}
                      className="p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-colors cursor-pointer"
                      title="Đánh dấu hoàn thành chặng này và chuyển sang chu kỳ tiếp theo"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => onToggleVideoSRS(video.id)}
                      className="p-2 rounded-lg hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                      title="Hủy kích hoạt SRS cho video này"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Next review date footer */}
                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-1 font-mono">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Lần ôn tập tiếp theo:</span>
                    <span className="text-slate-300 font-semibold">
                      {formatRelativeReview(video.srsNextReviewDate)}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Chu kỳ giãn cách: <span className="font-mono text-indigo-300">{video.srsInterval || 1} ngày</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
