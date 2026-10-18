import React, { useState, useEffect, useRef } from 'react';
import { VideoItem, VocabularyItem, SubtitleItem } from '../types';
import {
  MessageSquareQuote,
  Clock,
  Play,
  Pause,
  ChevronDown,
  ChevronUp,
  Volume2,
  Sparkles,
  ExternalLink,
  RotateCcw
} from 'lucide-react';

interface ContextPreviewProps {
  video?: VideoItem;
  vocab: VocabularyItem;
  className?: string;
  defaultExpanded?: boolean;
}

interface ContextLine {
  id: string;
  start: number;
  end: number;
  text: string;
  isTarget: boolean;
  type: 'before' | 'target' | 'after';
}

function formatSec(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export const ContextPreview: React.FC<ContextPreviewProps> = ({
  video,
  vocab,
  className = '',
  defaultExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isPlayingRange, setIsPlayingRange] = useState(false);
  const [activePlayingSec, setActivePlayingSec] = useState<number | null>(null);

  const playerRef = useRef<any>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const checkIntervalRef = useRef<any>(null);

  const targetTime = Number(vocab.timestamp) || 0;
  const windowStart = Math.max(0, targetTime - 5);
  const windowEnd = targetTime + 5;

  // Extract contextual subtitles within [-5s, +5s] window
  const contextLines: ContextLine[] = React.useMemo(() => {
    if (!video?.subtitles || video.subtitles.length === 0) {
      // Fallback: build a simulated window from contextSentence
      return [
        {
          id: 'ctx-before',
          start: windowStart,
          end: Math.max(windowStart, targetTime - 0.5),
          text: '... [Đoạn đối thoại trước đó trong video] ...',
          isTarget: false,
          type: 'before',
        },
        {
          id: 'ctx-target',
          start: targetTime,
          end: Math.min(windowEnd, targetTime + 4),
          text: vocab.contextSentence || vocab.word,
          isTarget: true,
          type: 'target',
        },
        {
          id: 'ctx-after',
          start: Math.min(windowEnd, targetTime + 4),
          end: windowEnd,
          text: '... [Đoạn đối thoại tiếp theo của diễn giả] ...',
          isTarget: false,
          type: 'after',
        },
      ];
    }

    // Filter subtitles overlapping with [windowStart, windowEnd]
    const sorted = [...video.subtitles].sort((a, b) => a.start - b.start);
    let matched = sorted.filter(
      (sub) => sub.end >= windowStart && sub.start <= windowEnd
    );

    // If range didn't capture enough, find the nearest subtitle to targetTime and grab neighbors
    if (matched.length === 0) {
      let closestIdx = 0;
      let minDiff = Infinity;
      sorted.forEach((sub, idx) => {
        const diff = Math.abs(sub.start - targetTime);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = idx;
        }
      });
      const startIdx = Math.max(0, closestIdx - 1);
      const endIdx = Math.min(sorted.length, closestIdx + 2);
      matched = sorted.slice(startIdx, endIdx);
    }

    const cleanWord = vocab.word.trim().toLowerCase();

    return matched.map((sub) => {
      const containsWord =
        cleanWord.length > 0 && sub.text.toLowerCase().includes(cleanWord);
      const isTimeMatch =
        targetTime >= sub.start - 0.5 && targetTime <= sub.end + 0.5;
      const isTarget = containsWord || isTimeMatch;

      let type: 'before' | 'target' | 'after' = 'target';
      if (!isTarget) {
        if (sub.end <= targetTime) {
          type = 'before';
        } else {
          type = 'after';
        }
      }

      return {
        id: sub.id,
        start: sub.start,
        end: sub.end,
        text: sub.text,
        isTarget,
        type,
      };
    });
  }, [video?.subtitles, targetTime, vocab.word, vocab.contextSentence, windowStart, windowEnd]);

  // Clean up player on unmount
  useEffect(() => {
    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try {
          playerRef.current.destroy();
        } catch (_) {}
      }
    };
  }, []);

  const handleStopAudio = () => {
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
      checkIntervalRef.current = null;
    }
    if (playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
      try {
        playerRef.current.pauseVideo();
      } catch (_) {}
    }
    setIsPlayingRange(false);
    setActivePlayingSec(null);
  };

  const handlePlayRange = (startSec = windowStart, endSec = windowEnd) => {
    if (!video?.youtubeId) return;

    if (isPlayingRange) {
      handleStopAudio();
      return;
    }

    setIsPlayingRange(true);
    setActivePlayingSec(startSec);

    const initOrPlay = () => {
      if (
        playerRef.current &&
        typeof playerRef.current.seekTo === 'function' &&
        typeof playerRef.current.playVideo === 'function'
      ) {
        playerRef.current.seekTo(startSec, true);
        playerRef.current.playVideo();

        if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);

        checkIntervalRef.current = setInterval(() => {
          if (!playerRef.current || typeof playerRef.current.getCurrentTime !== 'function') {
            return;
          }
          const curr = playerRef.current.getCurrentTime();
          setActivePlayingSec(curr);

          if (curr >= endSec) {
            handleStopAudio();
          }
        }, 150);
      }
    };

    if (playerRef.current) {
      initOrPlay();
    } else {
      // Initialize YouTube player
      const containerId = `yt-context-player-${vocab.id}`;
      const elem = document.getElementById(containerId);
      if (!elem) {
        setIsPlayingRange(false);
        return;
      }

      const createPlayer = () => {
        // @ts-ignore
        playerRef.current = new window.YT.Player(containerId, {
          height: '1',
          width: '1',
          videoId: video.youtubeId,
          playerVars: {
            start: Math.floor(startSec),
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
          },
          events: {
            onReady: (event: any) => {
              event.target.seekTo(startSec, true);
              event.target.playVideo();

              if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
              checkIntervalRef.current = setInterval(() => {
                if (!playerRef.current || typeof playerRef.current.getCurrentTime !== 'function') return;
                const curr = playerRef.current.getCurrentTime();
                setActivePlayingSec(curr);
                if (curr >= endSec) {
                  handleStopAudio();
                }
              }, 150);
            },
            onStateChange: (event: any) => {
              // 0 = ended, 2 = paused
              if (event.data === 0 || event.data === 2) {
                if (checkIntervalRef.current) {
                  clearInterval(checkIntervalRef.current);
                }
                setIsPlayingRange(false);
                setActivePlayingSec(null);
              }
            },
          },
        });
      };

      // @ts-ignore
      if (window.YT && window.YT.Player) {
        createPlayer();
      } else {
        const interval = setInterval(() => {
          // @ts-ignore
          if (window.YT && window.YT.Player) {
            clearInterval(interval);
            createPlayer();
          }
        }, 200);
      }
    }
  };

  // Highlight word occurrences
  const renderLineText = (text: string, isTargetLine: boolean) => {
    if (!vocab.word) return text;
    const escaped = vocab.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, idx) => {
      if (part.toLowerCase() === vocab.word.toLowerCase()) {
        return (
          <span
            key={idx}
            className="px-1.5 py-0.5 rounded font-bold bg-amber-400 text-slate-950 mx-0.5 shadow-sm inline-block"
          >
            {part}
          </span>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`rounded-xl border border-slate-800 bg-slate-950/90 overflow-hidden shadow-sm transition-all ${className}`}
    >
      {/* Hidden YouTube audio container */}
      <div
        id={`yt-context-player-${vocab.id}`}
        ref={playerContainerRef}
        className="hidden"
      />

      {/* Header bar / Tool trigger */}
      <div className="flex items-center justify-between p-3 bg-slate-900/80 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-400/10 border border-amber-400/20 text-amber-300 flex items-center justify-center">
            <MessageSquareQuote className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white tracking-wide">
                Context Preview
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 font-mono font-semibold">
                ±5s Window
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
              <Clock className="w-3 h-3 text-slate-500" />
              <span>
                {formatSec(windowStart)} - {formatSec(windowEnd)}
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-400">
                (Điểm bắt: {formatSec(targetTime)})
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Quick Play 10s audio button */}
          {video?.youtubeId && (
            <button
              onClick={() => handlePlayRange(windowStart, windowEnd)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm ${
                isPlayingRange
                  ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse'
                  : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
              }`}
              title="Phát 10s audio ngữ cảnh (5s trước và 5s sau)"
            >
              {isPlayingRange ? (
                <>
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>Dừng 10s</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Nghe 10s</span>
                </>
              )}
            </button>
          )}

          {/* Toggle expand/collapse */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title={isExpanded ? 'Thu gọn' : 'Xem chi tiết ngữ cảnh'}
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Snippet transcript content */}
      {isExpanded ? (
        <div className="p-3.5 space-y-2.5 animate-fadeIn">
          <div className="text-[11px] text-slate-400 leading-relaxed pb-1 border-b border-slate-900 flex items-center justify-between">
            <span>
              Đoạn hội thoại mở rộng <strong>5 giây trước</strong> và{' '}
              <strong>5 giây sau</strong> thời điểm xuất hiện từ:
            </span>
            <span className="text-[10px] text-amber-400 font-mono">
              {contextLines.length} câu thoại
            </span>
          </div>

          <div className="space-y-2 relative pl-2 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
            {contextLines.map((line, idx) => {
              const isCurrentlyPlayingThisLine =
                activePlayingSec !== null &&
                activePlayingSec >= line.start &&
                activePlayingSec <= line.end;

              return (
                <div
                  key={line.id || idx}
                  className={`relative pl-4 p-2.5 rounded-xl border text-xs transition-all ${
                    line.isTarget
                      ? 'bg-amber-500/10 border-amber-500/40 text-slate-100 shadow-sm'
                      : isCurrentlyPlayingThisLine
                      ? 'bg-indigo-950/40 border-indigo-500/40 text-slate-200'
                      : 'bg-slate-950/60 border-slate-800/80 text-slate-300'
                  }`}
                >
                  {/* Timeline bullet dot */}
                  <div
                    className={`absolute -left-[5px] top-3.5 w-2.5 h-2.5 rounded-full border-2 ${
                      line.isTarget
                        ? 'bg-amber-400 border-slate-950 ring-2 ring-amber-400/40'
                        : isCurrentlyPlayingThisLine
                        ? 'bg-indigo-400 border-slate-950 animate-ping'
                        : 'bg-slate-700 border-slate-950'
                    }`}
                  />

                  {/* Header of line: time & badge */}
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 font-mono text-[10px]">
                      <span className="text-slate-400">
                        {formatSec(line.start)} - {formatSec(line.end)}
                      </span>
                      {line.isTarget ? (
                        <span className="px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 font-bold font-sans">
                          🎯 Điểm xuất hiện từ ({formatSec(targetTime)})
                        </span>
                      ) : line.type === 'before' ? (
                        <span className="text-slate-500 italic">
                          ⏪ 5s trước (Dẫn dắt)
                        </span>
                      ) : (
                        <span className="text-slate-500 italic">
                          ⏩ 5s sau (Phản hồi)
                        </span>
                      )}
                    </div>

                    {/* Single line audio play */}
                    {video?.youtubeId && (
                      <button
                        onClick={() => handlePlayRange(line.start, line.end)}
                        className="px-2 py-0.5 rounded bg-slate-900 hover:bg-amber-400 hover:text-slate-950 text-slate-400 text-[10px] font-mono transition-colors flex items-center gap-1 cursor-pointer"
                        title="Nghe riêng câu này"
                      >
                        <Play className="w-2.5 h-2.5 fill-current" />
                        <span>Nghe</span>
                      </button>
                    )}
                  </div>

                  {/* Line text */}
                  <div className="leading-relaxed font-medium">
                    "{renderLineText(line.text, line.isTarget)}"
                  </div>
                </div>
              );
            })}
          </div>

          {/* Context tip footer */}
          <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>
              <strong>Bí quyết Comprehensible Input:</strong> Đọc và nghe cả câu trước lẫn câu sau giúp não bộ ghi nhớ ý nghĩa qua dòng chảy hội thoại tự nhiên, thay vì học vẹt từ đơn lẻ.
            </span>
          </div>
        </div>
      ) : (
        /* Collapsed Preview Teaser */
        <div
          onClick={() => setIsExpanded(true)}
          className="px-3.5 py-2 text-xs text-slate-400 flex items-center justify-between hover:bg-slate-900/40 transition-colors cursor-pointer"
        >
          <div className="truncate max-w-[85%] text-[11px]">
            <span className="text-amber-400 font-semibold mr-1.5">Xem trước:</span>
            <span className="italic">
              "{vocab.contextSentence || vocab.word}"
            </span>
          </div>
          <span className="text-[10px] text-amber-400 hover:underline font-mono whitespace-nowrap">
            Mở rộng (±5s) →
          </span>
        </div>
      )}
    </div>
  );
};
