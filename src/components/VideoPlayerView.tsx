import React, { useState, useEffect, useRef } from 'react';
import { VideoItem, VocabularyItem, SubtitleItem } from '../types';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  BookPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Sparkles,
  Repeat,
  Languages,
  EyeOff,
  HelpCircle,
  X,
  Plus
} from 'lucide-react';
import { speakEnglish } from '../utils/speech';
import { GoogleImageGallery } from './GoogleImageGallery';

interface VideoPlayerViewProps {
  video: VideoItem;
  onBack: () => void;
  onAddVocabToSRS: (vocab: VocabularyItem) => void;
  savedVocabIds: Set<string>;
  onToggleVideoSRS: (videoId: string) => void;
  onCompleteVideoStage?: (videoId: string, stage: number) => void;
  onAddWatchTime?: (seconds: number) => void;
}

export const VideoPlayerView: React.FC<VideoPlayerViewProps> = ({
  video,
  onBack,
  onAddVocabToSRS,
  savedVocabIds,
  onToggleVideoSRS,
  onCompleteVideoStage,
  onAddWatchTime,
}) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [loopCurrentSubtitle, setLoopCurrentSubtitle] = useState(false);
  const [subtitleMode, setSubtitleMode] = useState<'english' | 'hidden'>('english');
  const [selectedWord, setSelectedWord] = useState<{ word: string; sentence: string } | null>(null);
  const [wordLookupLoading, setWordLookupLoading] = useState(false);
  const [wordLookupData, setWordLookupData] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'vocab' | 'cefr' | 'srs'>('vocab');

  const playerRef = useRef<any>(null);
  const intervalRef = useRef<any>(null);
  const activeSubtitleRef = useRef<HTMLDivElement | null>(null);
  const watchSecondsAccumulatorRef = useRef<number>(0);

  // Find active subtitle matching currentTime
  const activeSubtitle = video.subtitles.find(
    (sub) => currentTime >= sub.start && currentTime <= sub.end
  ) || video.subtitles[0];

  const activeIndex = video.subtitles.findIndex(
    (sub) => currentTime >= sub.start && currentTime <= sub.end
  );

  // Initialize YouTube Iframe Player
  useEffect(() => {
    let isMounted = true;

    // Load YouTube Iframe API if not loaded
    const win = window as any;
    if (!win.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    const initPlayer = () => {
      const winYT = (window as any).YT;
      if (!isMounted || !winYT || !winYT.Player) return;
      try {
        playerRef.current = new winYT.Player('youtube-player-embed', {
          videoId: video.youtubeId,
          playerVars: {
            autoplay: 0,
            controls: 1,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
          },
          events: {
            onStateChange: (event: any) => {
              if (event.data === winYT.PlayerState?.PLAYING) {
                setIsPlaying(true);
              } else {
                setIsPlaying(false);
              }
            },
          },
        });
      } catch (err) {
        console.warn('YT Player init issue:', err);
      }
    };

    if (win.YT && win.YT.Player) {
      initPlayer();
    } else {
      (window as any).onYouTubeIframeAPIReady = initPlayer;
    }

    // Time polling loop & watch time tracking
    intervalRef.current = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        try {
          const time = playerRef.current.getCurrentTime();
          if (typeof time === 'number' && !isNaN(time)) {
            setCurrentTime(time);

            // Accumulate watch time when playing
            if (playerRef.current.getPlayerState?.() === 1) { // 1 = YT.PlayerState.PLAYING
              watchSecondsAccumulatorRef.current += 0.2;
              if (watchSecondsAccumulatorRef.current >= 4) {
                const secsToReport = Math.round(watchSecondsAccumulatorRef.current);
                watchSecondsAccumulatorRef.current = 0;
                if (onAddWatchTime) onAddWatchTime(secsToReport);
              }
            }

            // Handle segment loop for shadowing
            if (loopCurrentSubtitle && activeSubtitle) {
              if (time >= activeSubtitle.end) {
                playerRef.current.seekTo(activeSubtitle.start, true);
              }
            }
          }
        } catch (e) {
          // ignore transient poll error
        }
      }
    }, 200);

    return () => {
      isMounted = false;
      if (watchSecondsAccumulatorRef.current > 1 && onAddWatchTime) {
        onAddWatchTime(Math.round(watchSecondsAccumulatorRef.current));
        watchSecondsAccumulatorRef.current = 0;
      }
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try {
          playerRef.current.destroy();
        } catch (e) {}
      }
    };
  }, [video.youtubeId, loopCurrentSubtitle, activeSubtitle]);

  // Scroll active subtitle into view smoothly
  useEffect(() => {
    if (activeSubtitleRef.current) {
      activeSubtitleRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [activeIndex]);

  const seekTo = (seconds: number) => {
    if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
      playerRef.current.seekTo(seconds, true);
      playerRef.current.playVideo();
      setIsPlaying(true);
    }
  };

  const togglePlay = () => {
    if (playerRef.current) {
      if (isPlaying) {
        playerRef.current.pauseVideo();
      } else {
        playerRef.current.playVideo();
      }
    }
  };

  const changeSpeed = (speed: number) => {
    setPlaybackSpeed(speed);
    if (playerRef.current && typeof playerRef.current.setPlaybackRate === 'function') {
      playerRef.current.setPlaybackRate(speed);
    }
  };

  const handlePrevSubtitle = () => {
    const targetIdx = Math.max(0, (activeIndex === -1 ? 0 : activeIndex) - 1);
    seekTo(video.subtitles[targetIdx].start);
  };

  const handleNextSubtitle = () => {
    const targetIdx = Math.min(video.subtitles.length - 1, (activeIndex === -1 ? 0 : activeIndex) + 1);
    seekTo(video.subtitles[targetIdx].start);
  };

  // Word click to lookup
  const handleWordClick = async (word: string, sentence: string) => {
    const cleanWord = word.replace(/[^a-zA-Z'-]/g, '').trim();
    if (!cleanWord || cleanWord.length < 2) return;

    setSelectedWord({ word: cleanWord, sentence });
    setWordLookupLoading(true);
    setWordLookupData(null);

    // Speak word immediately
    speakEnglish(cleanWord);

    try {
      const res = await fetch('/api/lookup-word', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: cleanWord, contextSentence: sentence }),
      });
      const data = await res.json();
      if (data.success) {
        setWordLookupData(data.data);
      }
    } catch (e) {
      console.error('Word lookup failed:', e);
    } finally {
      setWordLookupLoading(false);
    }
  };

  const handleSaveLookedUpWord = () => {
    if (!selectedWord) return;
    const vocabItem: VocabularyItem = {
      id: `voc-custom-${Date.now()}-${selectedWord.word}`,
      word: wordLookupData?.word || selectedWord.word,
      phonetic: wordLookupData?.phonetic || '',
      partOfSpeech: wordLookupData?.partOfSpeech || 'vocabulary',
      definitionEn: wordLookupData?.definitionEn || 'Key contextual phrase in the video',
      contextSentence: selectedWord.sentence,
      exampleSentence: wordLookupData?.exampleSentence || selectedWord.sentence,
      collocations: wordLookupData?.collocations || [],
      timestamp: Math.round(currentTime),
      videoId: video.id,
      videoTitle: video.title,
      interval: 1,
      repetition: 0,
      easeFactor: 2.5,
      nextReviewDate: new Date().toISOString(),
      status: 'new',
    };
    onAddVocabToSRS(vocabItem);
  };

  const formatSec = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Top Bar Navigation & Video Info */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 transition-colors flex items-center gap-1 text-xs font-semibold cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Thư viện</span>
          </button>
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="font-semibold text-amber-400">{video.cefrLevel}</span>
              <span aria-hidden="true">·</span>
              <span>{video.topic}</span>
              <span aria-hidden="true">·</span>
              <span>{video.channel}</span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-white line-clamp-1">{video.title}</h1>
          </div>
        </div>

        {/* Video SRS Toggle Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggleVideoSRS(video.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
              video.inSrs
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{video.inSrs ? `Đang trong Lộ trình SRS (Chặng ${video.srsStage || 1}/4)` : '+ Ôn tập Video theo SRS'}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Player on Left, Tabs on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Player & Subtitles Deck (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Video Container */}
          <div className="relative aspect-[16/9] w-full bg-black rounded-xl overflow-hidden shadow-2xl border border-slate-800">
            <div id="youtube-player-embed" className="w-full h-full" />
          </div>

          {/* Interactive Player Controls Deck */}
          <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Play/Pause & Subtitle jumps */}
            <div className="flex items-center gap-2">
              <button
                onClick={togglePlay}
                className="p-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 transition-colors cursor-pointer"
                title={isPlaying ? 'Tạm dừng' : 'Phát tiếp'}
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-slate-950" /> : <Play className="w-4 h-4 fill-slate-950" />}
              </button>

              <button
                onClick={handlePrevSubtitle}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                title="Câu trước đó"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                onClick={() => activeSubtitle && seekTo(activeSubtitle.start)}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                title="Phát lại câu này"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={handleNextSubtitle}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                title="Câu kế tiếp"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              {/* Loop Segment for Shadowing */}
              <button
                onClick={() => setLoopCurrentSubtitle(!loopCurrentSubtitle)}
                className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1 font-medium transition-colors cursor-pointer ${
                  loopCurrentSubtitle
                    ? 'bg-amber-400 text-slate-950 font-bold'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
                title="Lặp lại câu này liên tục để luyện nói Shadowing"
              >
                <Repeat className="w-3.5 h-3.5" />
                <span>Lặp câu (Shadowing)</span>
              </button>
            </div>

            {/* Speed & Subtitle Display Toggles */}
            <div className="flex items-center gap-3">
              {/* Playback rate */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                {[0.75, 0.9, 1.0].map((rate) => (
                  <button
                    key={rate}
                    onClick={() => changeSpeed(rate)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                      playbackSpeed === rate
                        ? 'bg-amber-400 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>

              {/* Subtitle mode */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                <button
                  onClick={() => setSubtitleMode('english')}
                  className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                    subtitleMode === 'english'
                      ? 'bg-slate-700 text-white font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Hiện phụ đề tiếng Anh chuẩn"
                >
                  EN
                </button>
                <button
                  onClick={() => setSubtitleMode('hidden')}
                  className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                    subtitleMode === 'hidden'
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Ẩn phụ đề (Luyện nghe chay)"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Current Live Speaking Subtitle Focus Banner */}
          {activeSubtitle && subtitleMode !== 'hidden' && (
            <div className="p-4 bg-gradient-to-r from-amber-500/10 via-slate-900 to-slate-900 border border-amber-500/30 rounded-xl relative">
              <div className="flex items-center justify-between text-xs text-amber-400 mb-1.5 font-mono">
                <span>
                  ĐANG PHÁT [{formatSec(activeSubtitle.start)} - {formatSec(activeSubtitle.end)}]
                </span>
                <span className="text-slate-400 text-[11px]">Bấm vào từng từ tiếng Anh để tra cứu & lưu</span>
              </div>

              {/* Clickable Words */}
              <div className="text-base sm:text-lg font-semibold text-white leading-relaxed flex flex-wrap gap-x-1.5 gap-y-1">
                {activeSubtitle.text.split(' ').map((word, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleWordClick(word, activeSubtitle.text)}
                    className="hover:text-amber-300 hover:underline decoration-amber-400 underline-offset-4 transition-colors cursor-pointer rounded px-0.5"
                  >
                    {word}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Synchronized Subtitle Timeline Scroll */}
          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
            <div className="flex items-center justify-between mb-3 text-xs text-slate-400">
              <span className="font-semibold uppercase tracking-wider text-slate-300">
                Toàn bộ phụ đề ({video.subtitles.length} câu)
              </span>
              <span>Bấm vào mốc giờ để nhảy tới câu đó</span>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-800/40">
              {video.subtitles.map((sub, idx) => {
                const isActive = activeIndex === idx;
                return (
                  <div
                    key={sub.id || idx}
                    ref={isActive ? activeSubtitleRef : null}
                    onClick={() => seekTo(sub.start)}
                    className={`p-2.5 rounded-lg transition-all cursor-pointer flex items-start gap-3 ${
                      isActive
                        ? 'bg-amber-400/10 border-l-4 border-amber-400 text-white'
                        : 'hover:bg-slate-800/40 text-slate-300'
                    }`}
                  >
                    <span className="text-xs font-mono text-amber-400/80 bg-slate-950 px-1.5 py-0.5 rounded shrink-0">
                      {formatSec(sub.start)}
                    </span>
                    <div className="flex-1 text-xs">
                      <div className="font-medium text-slate-100">{sub.text}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Tabs Deck (Suggested Vocab, CEFR & CI, SRS Roadmap) (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Tab Navigation */}
          <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800 text-xs font-medium">
            <button
              onClick={() => setActiveTab('vocab')}
              className={`flex-1 py-2 text-center rounded-lg transition-colors cursor-pointer ${
                activeTab === 'vocab'
                  ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Từ Vựng Đề Xuất ({video.suggestedVocab.length})
            </button>
            <button
              onClick={() => setActiveTab('cefr')}
              className={`flex-1 py-2 text-center rounded-lg transition-colors cursor-pointer ${
                activeTab === 'cefr'
                  ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Độ Khó CEFR
            </button>
            <button
              onClick={() => setActiveTab('srs')}
              className={`flex-1 py-2 text-center rounded-lg transition-colors cursor-pointer ${
                activeTab === 'srs'
                  ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Lộ Trình Ôn Video
            </button>
          </div>

          {/* Tab Content 1: Suggested Vocab */}
          {activeTab === 'vocab' && (
            <div className="space-y-3">
              <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl text-xs text-slate-400 flex items-center justify-between">
                <span>Chọn từ bạn muốn thêm vào sổ học SRS:</span>
                <span className="text-amber-400 font-mono font-semibold">
                  {video.suggestedVocab.filter((v) => savedVocabIds.has(v.id)).length}/{video.suggestedVocab.length} đã lưu
                </span>
              </div>

              <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
                {video.suggestedVocab.map((vocab) => {
                  const isSaved = savedVocabIds.has(vocab.id);
                  return (
                    <div
                      key={vocab.id}
                      className={`p-3 rounded-xl border transition-all ${
                        isSaved
                          ? 'bg-emerald-950/20 border-emerald-500/40 text-slate-200'
                          : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">{vocab.word}</span>
                            <button
                              onClick={() => speakEnglish(vocab.word)}
                              className="text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
                              title="Nghe phát âm"
                            >
                              <Volume2 className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-xs text-slate-400 font-mono">{vocab.phonetic}</span>
                          </div>
                          <span className="text-[11px] text-amber-400/90 italic">{vocab.partOfSpeech}</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {vocab.timestamp !== undefined && (
                            <button
                              onClick={() => seekTo(vocab.timestamp)}
                              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-mono transition-colors cursor-pointer"
                              title="Xem lại đoạn xuất hiện từ này"
                            >
                              {formatSec(vocab.timestamp)}
                            </button>
                          )}
                          <button
                            onClick={() => onAddVocabToSRS(vocab)}
                            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                              isSaved
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                            }`}
                          >
                            {isSaved ? '✓ Đã Lưu SRS' : '+ Lưu SRS'}
                          </button>
                        </div>
                      </div>

                      <div className="mt-1.5 text-xs text-amber-300/90 font-medium">
                        {vocab.definitionEn || vocab.word}
                      </div>

                      <div className="mt-1 text-[11px] text-slate-400 italic bg-slate-950/40 p-1.5 rounded">
                        "{vocab.contextSentence}"
                      </div>

                      {vocab.collocations && vocab.collocations.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {vocab.collocations.map((col, cIdx) => (
                            <span
                              key={cIdx}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono"
                            >
                              {col}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab Content 2: CEFR & Krashen Comprehensible Input details */}
          {activeTab === 'cefr' && (
            <div className="p-5 bg-slate-900/80 border border-slate-800 rounded-xl space-y-4">
              <div>
                <span className="text-xs text-slate-400 block mb-1">Cấp độ tiếp thu CEFR</span>
                <div className="flex items-center gap-2">
                  <span className="text-3xl font-black text-amber-400 font-mono">{video.cefrLevel}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-amber-400/10 text-amber-300 border border-amber-400/20 font-medium">
                    Phù hợp người học {video.cefrLevel}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Đánh giá sư phạm (Krashen i+1)
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                  {video.cefrReason}
                </p>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Mẹo tiếp nhận Comprehensible Input
                </h4>
                <ul className="space-y-2 text-xs text-slate-300">
                  {video.comprehensibilityTips.map((tip, idx) => (
                    <li key={idx} className="flex items-start gap-2 bg-slate-950/40 p-2.5 rounded border border-slate-800/80">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Tóm tắt video</h4>
                <p className="text-xs text-slate-400 leading-relaxed">{video.summary}</p>
              </div>
            </div>
          )}

          {/* Tab Content 3: Video Spaced Repetition (Ôn tập video ngắt quãng) */}
          {activeTab === 'srs' && (
            <div className="p-5 bg-slate-900/80 border border-slate-800 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-indigo-400" />
                    <span>Lộ Trình Ôn Tập Video Ngắt Quãng</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Lặp lại ngắt quãng 4 giai đoạn giúp não bộ lưu trữ ngữ cảnh sâu sắc.
                  </p>
                </div>
              </div>

              {/* 4 Stages */}
              <div className="space-y-2.5">
                {[
                  {
                    stage: 1,
                    title: 'Chặng 1: Nghe hiểu toàn diện (Phụ đề tiếng Anh)',
                    desc: 'Bật phụ đề tiếng Anh, nghe 2 lần để hiểu 85%+ nội dung và ngữ cảnh.',
                  },
                  {
                    stage: 2,
                    title: 'Chặng 2: Thử thách ẩn phụ đề (Blind Listening)',
                    desc: 'Ẩn phụ đề, tập trung 100% vào ngữ điệu và âm thanh tự nhiên.',
                  },
                  {
                    stage: 3,
                    title: 'Chặng 3: Luyện nói Shadowing',
                    desc: 'Dùng tính năng "Lặp câu" để nhại giọng nói ngay sau diễn giả với nhịp điệu tương đương.',
                  },
                  {
                    stage: 4,
                    title: 'Chặng 4: Củng cố & Tự tóm tắt',
                    desc: 'Tự thuật lại câu chuyện bằng 3 câu tiếng Anh không nhìn tài liệu.',
                  },
                ].map((step) => {
                  const currentStage = video.srsStage || 1;
                  const isCurrent = video.inSrs && currentStage === step.stage;
                  const isCompleted = video.inSrs && currentStage > step.stage;

                  return (
                    <div
                      key={step.stage}
                      className={`p-3 rounded-lg border text-xs transition-all ${
                        isCurrent
                          ? 'bg-amber-400/10 border-amber-400 text-slate-200'
                          : isCompleted
                          ? 'bg-emerald-950/20 border-emerald-500/40 text-slate-300'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-bold flex items-center gap-2">
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono ${
                              isCompleted
                                ? 'bg-emerald-500 text-slate-950 font-bold'
                                : isCurrent
                                ? 'bg-amber-400 text-slate-950 font-bold'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {isCompleted ? '✓' : step.stage}
                          </span>
                          <span className={isCurrent ? 'text-amber-300' : 'text-slate-200'}>{step.title}</span>
                        </div>

                        {video.inSrs && isCurrent && onCompleteVideoStage && (
                          <button
                            onClick={() => onCompleteVideoStage(video.id, step.stage)}
                            className="px-2 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-[11px] rounded transition-colors cursor-pointer"
                          >
                            Hoàn thành chặng {step.stage}
                          </button>
                        )}
                      </div>
                      <p className="mt-1.5 text-slate-400 pl-7">{step.desc}</p>
                    </div>
                  );
                })}
              </div>

              {!video.inSrs ? (
                <button
                  onClick={() => onToggleVideoSRS(video.id)}
                  className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Kích hoạt Ôn Tập Ngắt Quãng cho Video Này</span>
                </button>
              ) : (
                <div className="p-3 bg-slate-950 rounded-lg text-xs text-slate-400 space-y-1">
                  <div className="flex justify-between">
                    <span>Lần ôn tập tiếp theo:</span>
                    <span className="text-indigo-300 font-mono font-semibold">
                      {video.srsNextReviewDate
                        ? new Date(video.srsNextReviewDate).toLocaleDateString('vi-VN')
                        : 'Hôm nay'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Số lần đã ôn tập:</span>
                    <span className="text-slate-200 font-mono">{video.srsRepetition || 0} lần</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Floating Word Lookup Popover / Modal when clicked */}
      {selectedWord && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 shadow-2xl relative">
            <button
              onClick={() => setSelectedWord(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-xl font-bold text-white">{selectedWord.word}</h3>
              <button
                onClick={() => speakEnglish(selectedWord.word)}
                className="p-1.5 rounded-lg bg-amber-400/20 text-amber-300 hover:bg-amber-400/30 transition-colors cursor-pointer"
                title="Phát âm chuẩn"
              >
                <Volume2 className="w-4 h-4" />
              </button>
              {wordLookupData?.phonetic && (
                <span className="text-xs text-slate-400 font-mono">{wordLookupData.phonetic}</span>
              )}
            </div>

            {wordLookupLoading ? (
              <div className="py-6 text-center text-xs text-slate-400 animate-pulse">
                Đang tra cứu nghĩa và cụm từ theo ngữ cảnh...
              </div>
            ) : (
              <div className="space-y-3 mt-3">
                {wordLookupData?.partOfSpeech && (
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-medium">
                    {wordLookupData.partOfSpeech}
                  </span>
                )}

                {wordLookupData?.definitionEn && (
                  <div className="text-sm font-medium text-slate-100 leading-relaxed bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[11px] uppercase tracking-wider text-amber-400 font-bold block mb-1">
                      Learner's Definition:
                    </span>
                    {wordLookupData.definitionEn}
                  </div>
                )}

                <div className="text-xs text-slate-300 italic bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  "{selectedWord.sentence}"
                </div>

                {/* Google Images visual anchor */}
                <GoogleImageGallery
                  query={selectedWord.word}
                  variant="compact"
                />

                {wordLookupData?.collocations && wordLookupData.collocations.length > 0 && (
                  <div>
                    <span className="text-[11px] text-slate-500 uppercase font-semibold">Cụm từ hay gặp:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {wordLookupData.collocations.map((col: string, idx: number) => (
                        <span key={idx} className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                          {col}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                  <button
                    onClick={() => setSelectedWord(null)}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    Đóng
                  </button>
                  <button
                    onClick={() => {
                      handleSaveLookedUpWord();
                      setSelectedWord(null);
                    }}
                    className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <BookPlus className="w-3.5 h-3.5" />
                    <span>Lưu Vào Sổ Học SRS</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
