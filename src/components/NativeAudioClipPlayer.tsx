import React, { useState, useEffect, useRef } from 'react';
import { VideoItem, VocabularyItem } from '../types';
import { speakEnglish } from '../utils/speech';
import {
  Volume2,
  Play,
  Pause,
  RotateCcw,
  Repeat,
  Video as VideoIcon,
  VideoOff,
  Sparkles,
  Loader2
} from 'lucide-react';

interface NativeAudioClipPlayerProps {
  video?: VideoItem;
  vocab: VocabularyItem;
  variant?: 'card' | 'compact';
  onPlayStateChange?: (isPlaying: boolean) => void;
}

export const NativeAudioClipPlayer: React.FC<NativeAudioClipPlayerProps> = ({
  video,
  vocab,
  variant = 'card',
  onPlayStateChange,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [isLooping, setIsLooping] = useState(false);
  const [showVideoVisual, setShowVideoVisual] = useState(false);
  const [currentTimeProgress, setCurrentTimeProgress] = useState(0);

  const playerIdRef = useRef(`yt-audio-clip-${Math.random().toString(36).substring(2, 9)}`);
  const playerRef = useRef<any>(null);
  const intervalRef = useRef<any>(null);

  // Compute exact snippet start and end from video subtitles
  const { start, end, clipDuration } = React.useMemo(() => {
    if (!video || !video.subtitles || video.subtitles.length === 0) {
      const s = Math.max(0, (vocab.timestamp || 0) - 0.5);
      const e = s + 4;
      return { start: s, end: e, clipDuration: 4 };
    }

    // 1. Try matching by context sentence
    const cleanContext = vocab.contextSentence.toLowerCase().trim();
    const matchedSub = video.subtitles.find(
      (sub) =>
        sub.text.toLowerCase().includes(cleanContext) ||
        cleanContext.includes(sub.text.toLowerCase())
    );

    if (matchedSub) {
      return {
        start: matchedSub.start,
        end: matchedSub.end,
        clipDuration: Math.max(1, matchedSub.end - matchedSub.start),
      };
    }

    // 2. Match by timestamp window
    const targetTime = vocab.timestamp || 0;
    const timeMatched = video.subtitles.find(
      (sub) => targetTime >= sub.start && targetTime <= sub.end
    );

    if (timeMatched) {
      return {
        start: timeMatched.start,
        end: timeMatched.end,
        clipDuration: Math.max(1, timeMatched.end - timeMatched.start),
      };
    }

    // 3. Fallback to timestamp ± 3s
    const fallbackStart = Math.max(0, targetTime - 0.5);
    const fallbackEnd = fallbackStart + 4;
    return {
      start: fallbackStart,
      end: fallbackEnd,
      clipDuration: 4,
    };
  }, [video, vocab]);

  const youtubeId = video?.youtubeId;

  // Initialize YouTube player instance for this clip
  useEffect(() => {
    if (!youtubeId) return;

    let isMounted = true;

    const initYT = () => {
      const win = window as any;
      if (!isMounted || !win.YT || !win.YT.Player) return;

      const element = document.getElementById(playerIdRef.current);
      if (!element) return;

      try {
        if (playerRef.current && typeof playerRef.current.destroy === 'function') {
          try { playerRef.current.destroy(); } catch (_) {}
        }

        playerRef.current = new win.YT.Player(playerIdRef.current, {
          height: '100%',
          width: '100%',
          videoId: youtubeId,
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            start: Math.floor(start),
          },
          events: {
            onReady: (event: any) => {
              if (isMounted) {
                setIsPlayerReady(true);
                try {
                  event.target.setPlaybackRate(playbackSpeed);
                } catch (_) {}
              }
            },
            onStateChange: (event: any) => {
              const winYT = (window as any).YT;
              if (event.data === winYT.PlayerState?.ENDED) {
                if (isLooping) {
                  playSnippet();
                } else {
                  setIsPlaying(false);
                  onPlayStateChange?.(false);
                }
              }
            },
          },
        });
      } catch (e) {
        console.warn('Native audio player init error:', e);
      }
    };

    const win = window as any;
    if (win.YT && win.YT.Player) {
      initYT();
    } else {
      win.onYouTubeIframeAPIReady = initYT;
    }

    return () => {
      isMounted = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try {
          playerRef.current.destroy();
        } catch (_) {}
      }
    };
  }, [youtubeId, start]);

  // Polling loop to enforce exact snippet stop time
  useEffect(() => {
    if (!isPlaying) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        try {
          const current = playerRef.current.getCurrentTime();
          if (typeof current === 'number' && !isNaN(current)) {
            const elapsed = Math.max(0, current - start);
            setCurrentTimeProgress(Math.min(clipDuration, elapsed));

            if (current >= end) {
              if (isLooping) {
                playerRef.current.seekTo(start, true);
                setCurrentTimeProgress(0);
              } else {
                playerRef.current.pauseVideo();
                setIsPlaying(false);
                setCurrentTimeProgress(0);
                onPlayStateChange?.(false);
              }
            }
          }
        } catch (_) {}
      }
    }, 100);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, start, end, isLooping, clipDuration]);

  const playSnippet = () => {
    if (!playerRef.current || !isPlayerReady) {
      // Fallback to TTS if YouTube player is still bootstrapping
      speakEnglish(vocab.word);
      return;
    }

    try {
      playerRef.current.seekTo(start, true);
      playerRef.current.playVideo();
      setIsPlaying(true);
      setCurrentTimeProgress(0);
      onPlayStateChange?.(true);
    } catch (e) {
      console.warn('Error playing snippet:', e);
      speakEnglish(vocab.word);
    }
  };

  const pauseSnippet = () => {
    if (playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
      try {
        playerRef.current.pauseVideo();
      } catch (_) {}
    }
    setIsPlaying(false);
    onPlayStateChange?.(false);
  };

  const togglePlay = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isPlaying) {
      pauseSnippet();
    } else {
      playSnippet();
    }
  };

  const changeSpeed = (speed: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setPlaybackSpeed(speed);
    if (playerRef.current && typeof playerRef.current.setPlaybackRate === 'function') {
      try {
        playerRef.current.setPlaybackRate(speed);
      } catch (_) {}
    }
  };

  const formatSec = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // If no parent video exists, fallback to TTS pronunciation
  if (!youtubeId) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          speakEnglish(vocab.word);
        }}
        className="p-2 rounded-lg bg-amber-400/20 text-amber-300 hover:bg-amber-400/30 transition-colors cursor-pointer"
        title="Phát âm tiếng Anh chuẩn (TTS)"
      >
        <Volume2 className="w-5 h-5" />
      </button>
    );
  }

  // COMPACT VARIANT: For table rows / cards list
  if (variant === 'compact') {
    return (
      <div className="relative inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        {/* Hidden video frame */}
        <div className="sr-only">
          <div id={playerIdRef.current} />
        </div>

        <button
          onClick={togglePlay}
          className={`p-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 cursor-pointer ${
            isPlaying
              ? 'bg-amber-400 text-slate-950 font-bold shadow-md animate-pulse'
              : 'bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 border border-amber-500/30'
          }`}
          title={`Phát đoạn audio gốc trong video (${formatSec(start)} - ${formatSec(end)})`}
        >
          {isPlaying ? (
            <>
              <Pause className="w-3.5 h-3.5 fill-slate-950" />
              <span className="text-[11px] font-mono">Dừng</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-amber-300" />
              <span className="text-[11px] font-mono">Audio gốc ({formatSec(start)})</span>
            </>
          )}
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            speakEnglish(vocab.word);
          }}
          className="p-1 rounded text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
          title="Đọc phát âm từ đơn (TTS)"
        >
          <Volume2 className="w-3 h-3" />
        </button>
      </div>
    );
  }

  // CARD VARIANT: Full rich controller on the Flashcard
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="w-full mt-4 p-4 rounded-xl bg-slate-950/90 border border-amber-500/30 shadow-lg space-y-3"
    >
      {/* Top Header: Source clip info & Visual toggle */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-amber-400 font-mono font-semibold">
          <span className="flex h-2 w-2 relative">
            {isPlaying && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            )}
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
          </span>
          <span>AUDIO GỐC TỪ VIDEO</span>
          <span className="text-slate-400 font-normal">
            [{formatSec(start)} - {formatSec(end)}]
          </span>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowVideoVisual(!showVideoVisual);
          }}
          className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
          title="Xem video clip gốc hoặc chỉ nghe audio"
        >
          {showVideoVisual ? (
            <>
              <VideoOff className="w-3 h-3 text-amber-400" />
              <span>Ẩn video</span>
            </>
          ) : (
            <>
              <VideoIcon className="w-3 h-3 text-slate-400" />
              <span>Xem clip video</span>
            </>
          )}
        </button>
      </div>

      {/* Video Visual Frame (Shown when toggled or hidden in background) */}
      <div
        className={`rounded-lg overflow-hidden transition-all duration-300 ${
          showVideoVisual
            ? 'aspect-video w-full bg-black border border-slate-800'
            : 'w-0 h-0 opacity-0 pointer-events-none absolute'
        }`}
      >
        <div id={playerIdRef.current} className="w-full h-full" />
      </div>

      {/* Controls Deck */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        {/* Play/Pause Button + Soundwave Animation */}
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            className={`px-4 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-2 cursor-pointer shadow-md ${
              isPlaying
                ? 'bg-amber-400 text-slate-950 scale-102 ring-2 ring-amber-400/50'
                : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4 fill-slate-950" />
                <span>Tạm dừng audio</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-slate-950" />
                <span>Nghe Audio Gốc</span>
              </>
            )}
          </button>

          {/* Soundwave bars indicator */}
          <div className="flex items-center gap-1 h-5 px-2">
            {[40, 75, 100, 60, 90, 45].map((h, idx) => (
              <span
                key={idx}
                className={`w-1 rounded-full bg-amber-400 transition-all duration-150 ${
                  isPlaying ? 'animate-pulse' : 'opacity-30'
                }`}
                style={{
                  height: isPlaying ? `${Math.max(6, (h * (idx % 2 === 0 ? 0.9 : 1.2)) / 4)}px` : '4px',
                  animationDelay: `${idx * 100}ms`,
                }}
              />
            ))}
          </div>
        </div>

        {/* Speed & Shadowing Loop Tools */}
        <div className="flex items-center gap-2 text-xs">
          {/* Loop toggle for Shadowing */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsLooping(!isLooping);
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer ${
              isLooping
                ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40 font-bold'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
            title="Lặp lại câu này liên tục để luyện nói Shadowing"
          >
            <Repeat className="w-3.5 h-3.5" />
            <span>Lặp lại câu</span>
          </button>

          {/* Speed selectors */}
          <div className="flex items-center p-0.5 bg-slate-900 rounded-lg border border-slate-800 text-[11px] font-mono">
            {[0.75, 1.0].map((rate) => (
              <button
                key={rate}
                onClick={(e) => changeSpeed(rate, e)}
                className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                  playbackSpeed === rate
                    ? 'bg-amber-400 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>

          {/* Secondary TTS Pronunciation */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              speakEnglish(vocab.word);
            }}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition-colors cursor-pointer"
            title="Đọc từ đơn bằng giọng máy TTS"
          >
            <Volume2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progress timeline */}
      <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
        <div
          className="bg-amber-400 h-full transition-all duration-100"
          style={{ width: `${(currentTimeProgress / Math.max(0.1, clipDuration)) * 100}%` }}
        />
      </div>
    </div>
  );
};
