import React, { useState } from 'react';
import { VocabularyItem, VideoItem } from '../types';
import { calculateNextVocabSRS, SRSGrade, isDueForReview, formatRelativeReview } from '../utils/srs';
import { speakEnglish } from '../utils/speech';
import { NativeAudioClipPlayer } from './NativeAudioClipPlayer';
import { VideoSnapshotFrame } from './VideoSnapshotFrame';
import { GoogleImageGallery } from './GoogleImageGallery';
import { ContextPreview } from './ContextPreview';
import {
  Volume2,
  CheckCircle,
  RotateCw,
  Search,
  Sparkles,
  BookOpen,
  Calendar,
  Layers,
  Award,
  ChevronRight,
  Trash2,
  Headphones,
  Edit3,
  Check,
  X,
  Camera,
  HelpCircle,
  Image as ImageIcon
} from 'lucide-react';

interface VocabSRSViewProps {
  vocabularyList: VocabularyItem[];
  videos?: VideoItem[];
  onUpdateVocab: (updatedVocab: VocabularyItem) => void;
  onDeleteVocab: (vocabId: string) => void;
  onSelectVideoToPlayById?: (videoId: string) => void;
}

function renderClozeSentence(sentence: string, targetWord: string, isBlank = true) {
  if (!sentence) return sentence;
  if (!targetWord) return sentence;

  const escaped = targetWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = sentence.split(regex);

  return parts.map((part, idx) => {
    if (part.toLowerCase() === targetWord.toLowerCase()) {
      if (isBlank) {
        return (
          <span
            key={idx}
            className="inline-flex items-center px-3 py-0.5 mx-1 font-mono font-bold bg-amber-400/20 text-amber-300 border-b-2 border-amber-400 rounded"
          >
            [ ________ ]
          </span>
        );
      }
      return (
        <span
          key={idx}
          className="inline-flex items-center px-1.5 py-0.5 mx-0.5 font-bold bg-amber-400/20 text-amber-300 rounded underline decoration-amber-400"
        >
          {part}
        </span>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

export const VocabSRSView: React.FC<VocabSRSViewProps> = ({
  vocabularyList,
  videos = [],
  onUpdateVocab,
  onDeleteVocab,
  onSelectVideoToPlayById,
}) => {
  const [mode, setMode] = useState<'study' | 'list'>('study');
  const [filter, setFilter] = useState<'all' | 'due' | 'learning' | 'mastered'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Flashcard review session state
  const dueItems = vocabularyList.filter((item) => isDueForReview(item.nextReviewDate));
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [completedSession, setCompletedSession] = useState(false);
  const [cardFormat, setCardFormat] = useState<'sentence' | 'cloze' | 'classic'>('sentence');
  const [clozeInput, setClozeInput] = useState('');
  const [clozeImageTab, setClozeImageTab] = useState<'video' | 'google'>('video');

  const currentItem = dueItems[currentReviewIndex];

  // Find parent video of currently reviewed vocabulary item
  const currentVideo = currentItem
    ? videos.find(
        (v) =>
          v.id === currentItem.videoId ||
          v.youtubeId === currentItem.videoId ||
          v.title === currentItem.videoTitle
      )
    : undefined;

  const handleGrade = (grade: SRSGrade) => {
    if (!currentItem) return;

    const srsResult = calculateNextVocabSRS(currentItem, grade);
    const updated: VocabularyItem = {
      ...currentItem,
      ...srsResult,
      lastReviewedDate: new Date().toISOString(),
      reviewHistory: [
        ...(currentItem.reviewHistory || []),
        { date: new Date().toISOString(), grade },
      ],
    };

    onUpdateVocab(updated);
    setIsFlipped(false);
    setClozeInput('');

    if (currentReviewIndex + 1 < dueItems.length) {
      setCurrentReviewIndex(currentReviewIndex + 1);
    } else {
      setCompletedSession(true);
    }
  };

  const handleRestartSession = () => {
    setCurrentReviewIndex(0);
    setIsFlipped(false);
    setClozeInput('');
    setCompletedSession(false);
  };

  // Filtered vocabulary list
  const filteredList = vocabularyList.filter((item) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      item.word.toLowerCase().includes(query) ||
      (item.definitionEn && item.definitionEn.toLowerCase().includes(query)) ||
      (item.contextSentence && item.contextSentence.toLowerCase().includes(query));
    if (!matchesSearch) return false;

    if (filter === 'due') return isDueForReview(item.nextReviewDate);
    if (filter === 'learning') return item.status === 'learning' || item.status === 'new';
    if (filter === 'mastered') return item.status === 'mastered';
    return true;
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header & Stats Overview */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-xs text-amber-400 font-mono mb-1">
            <span>SPACED REPETITION SYSTEM</span>
            <span aria-hidden="true">·</span>
            <span>SUPERMEMO SM-2</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white font-['Plus_Jakarta_Sans']">
            Sổ Từ Vựng Lặp Lại Ngắt Quãng
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Ghi nhớ từ vựng sâu sắc bằng cách ôn lại đúng thời điểm não bộ chuẩn bị quên theo đường cong lãng quên Ebbinghaus.
          </p>
        </div>

        {/* Mode switch */}
        <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-xl">
          <button
            onClick={() => setMode('study')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              mode === 'study'
                ? 'bg-amber-400 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ôn Tập Flashcard ({dueItems.length})</span>
          </button>
          <button
            onClick={() => setMode('list')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              mode === 'list'
                ? 'bg-amber-400 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Danh Sách ({vocabularyList.length})</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
          <div className="text-xs text-slate-400">Đến hạn hôm nay</div>
          <div className="text-2xl font-black text-amber-400 font-mono mt-1">{dueItems.length}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Cần ôn tập ngay</div>
        </div>
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
          <div className="text-xs text-slate-400">Đang học</div>
          <div className="text-2xl font-black text-indigo-400 font-mono mt-1">
            {vocabularyList.filter((v) => v.status === 'learning' || v.status === 'new').length}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Khoảng cách 1-7 ngày</div>
        </div>
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
          <div className="text-xs text-slate-400">Đã thành thạo</div>
          <div className="text-2xl font-black text-emerald-400 font-mono mt-1">
            {vocabularyList.filter((v) => v.status === 'mastered').length}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Khoảng cách &gt; 21 ngày</div>
        </div>
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
          <div className="text-xs text-slate-400">Tổng từ đã lưu</div>
          <div className="text-2xl font-black text-white font-mono mt-1">{vocabularyList.length}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Từ video Comprehensible Input</div>
        </div>
      </div>

      {/* MODE 1: STUDY FLASHCARD */}
      {mode === 'study' && (
        <div className="max-w-2xl mx-auto">
          {dueItems.length === 0 ? (
            <div className="p-8 text-center bg-slate-900/60 border border-slate-800 rounded-2xl">
              <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-white">Xuất Sắc! Bạn Đã Hoàn Thành Hết Từ Vựng Hôm Nay</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Không có từ nào đến hạn cần ôn lại lúc này. Hãy tiếp tục xem thêm YouTube Shorts để nạp thêm Comprehensible Input và lưu từ mới!
              </p>
              <button
                onClick={() => setMode('list')}
                className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Xem lại toàn bộ danh sách từ
              </button>
            </div>
          ) : completedSession ? (
            <div className="p-8 text-center bg-slate-900/60 border border-slate-800 rounded-2xl">
              <Award className="w-12 h-12 text-amber-400 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-white">Phiên Ôn Tập Đã Hoàn Thành!</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Bạn đã hoàn thành đánh giá cho {dueItems.length} từ vựng. Thuật toán SM-2 đã tự động gia hạn ngày ôn tập tiếp theo cho từng từ.
              </p>
              <div className="mt-5 flex items-center justify-center gap-3">
                <button
                  onClick={handleRestartSession}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Ôn Lại Phiên Này</span>
                </button>
                <button
                  onClick={() => setMode('list')}
                  className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Xem Bảng Từ Vựng
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Card format switcher */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-xl text-xs">
                <button
                  onClick={() => {
                    setCardFormat('sentence');
                    setIsFlipped(false);
                  }}
                  className={`flex-1 py-1.5 px-2 rounded-lg font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                    cardFormat === 'sentence'
                      ? 'bg-amber-400 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Mặt trước: Audio gốc | Mặt sau: Transcript + Hình ảnh video"
                >
                  <Headphones className="w-3.5 h-3.5" />
                  <span>Thẻ Câu (Audio Gốc)</span>
                </button>

                <button
                  onClick={() => {
                    setCardFormat('cloze');
                    setIsFlipped(false);
                  }}
                  className={`flex-1 py-1.5 px-2 rounded-lg font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                    cardFormat === 'cloze'
                      ? 'bg-amber-400 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Mặt trước: Câu khuyết + Ảnh chụp | Mặt sau: Cụm từ cần học"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Thẻ Điền Vào Chỗ Trống</span>
                </button>

                <button
                  onClick={() => {
                    setCardFormat('classic');
                    setIsFlipped(false);
                  }}
                  className={`flex-1 py-1.5 px-2 rounded-lg font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                    cardFormat === 'classic'
                      ? 'bg-amber-400 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Thẻ từ vựng & ngữ cảnh tiêu chuẩn"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Thẻ Từ Vựng Chuẩn</span>
                </button>
              </div>

              {/* Progress counter */}
              <div className="flex items-center justify-between text-xs text-slate-400 px-1 font-mono">
                <span>
                  Thẻ {currentReviewIndex + 1} / {dueItems.length}
                </span>
                <span>Khoảng cách hiện tại: {currentItem.interval || 1} ngày</span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-amber-400 h-full transition-all duration-300"
                  style={{ width: `${((currentReviewIndex + 1) / dueItems.length) * 100}%` }}
                />
              </div>

              {/* Flashcard surface */}
              <div
                onClick={() => {
                  if (cardFormat !== 'cloze' && !isFlipped) {
                    setIsFlipped(true);
                  }
                }}
                className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 p-6 sm:p-8 rounded-2xl min-h-[340px] flex flex-col justify-between transition-all shadow-xl relative"
              >
                {/* 1. THẺ CÂU: Mặt trước: Audio gốc | Mặt sau: Transcript + Hình ảnh video */}
                {cardFormat === 'sentence' && (
                  <>
                    {!isFlipped ? (
                      // Front: Audio gốc (không lộ chữ)
                      <div className="space-y-4">
                        <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
                          <span className="font-mono text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                            <Headphones className="w-3.5 h-3.5" />
                            <span>Thẻ Luyện Nghe Câu · Mặt Trước</span>
                          </span>
                          {currentItem.videoTitle && (
                            <span className="line-clamp-1 max-w-[200px] text-slate-500 text-[11px]">
                              Nguồn: {currentItem.videoTitle}
                            </span>
                          )}
                        </div>

                        <div className="p-4 bg-slate-950/80 rounded-xl border border-amber-500/20 text-center space-y-2">
                          <div className="w-12 h-12 rounded-full bg-amber-400/10 text-amber-300 flex items-center justify-center mx-auto mb-2 border border-amber-400/20">
                            <Headphones className="w-6 h-6 text-amber-400" />
                          </div>
                          <h3 className="text-base font-bold text-white">Lắng Nghe Đoạn Audio Gốc Từ Video</h3>
                          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                            Tập trung lắng nghe phát âm và ngữ điệu tự nhiên của người bản xứ trong video để thử đoán nghĩa trước khi lật thẻ.
                          </p>
                        </div>

                        {/* Native audio player */}
                        <NativeAudioClipPlayer
                          video={currentVideo}
                          vocab={currentItem}
                          variant="card"
                        />

                        <button
                          onClick={() => setIsFlipped(true)}
                          className="w-full py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md text-center"
                        >
                          Lật thẻ xem Transcript & Hình ảnh chụp từ video gốc →
                        </button>
                      </div>
                    ) : (
                      // Back: Transcript + Hình ảnh chụp từ đoạn đó trong video gốc
                      <div className="space-y-4 animate-fadeIn">
                        <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
                          <span className="font-mono text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5" />
                            <span>Transcript & Hình Ảnh Đoạn Video Gốc · Mặt Sau</span>
                          </span>
                        </div>

                        {/* Transcript */}
                        <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1">
                          <span className="text-[11px] uppercase tracking-wider text-amber-400 font-bold block">
                            Transcript Câu Thoại:
                          </span>
                          <div className="text-base font-semibold text-white leading-relaxed">
                            "{renderClozeSentence(currentItem.contextSentence, currentItem.word, false)}"
                          </div>
                        </div>

                        {/* Hình ảnh từ video gốc & Hình ảnh từ Google Images */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block mb-1.5 flex items-center gap-1">
                              <Camera className="w-3.5 h-3.5 text-amber-400" />
                              <span>Ảnh Chụp Video Gốc:</span>
                            </span>
                            <VideoSnapshotFrame
                              video={currentVideo}
                              timestamp={currentItem.timestamp}
                              altText={currentItem.contextSentence}
                            />
                          </div>

                          <div>
                            <span className="text-[11px] uppercase tracking-wider text-amber-400 font-bold block mb-1.5 flex items-center gap-1">
                              <ImageIcon className="w-3.5 h-3.5" />
                              <span>Ảnh Từ Google Images:</span>
                            </span>
                            <GoogleImageGallery
                              query={currentItem.word}
                              variant="card"
                            />
                          </div>
                        </div>

                        {/* Target vocabulary breakdown */}
                        <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-amber-400">{currentItem.word}</span>
                            <span className="text-xs text-slate-400 font-mono">
                              {currentItem.phonetic} · <span className="italic">{currentItem.partOfSpeech}</span>
                            </span>
                          </div>
                          <div className="text-xs text-slate-200">
                            {currentItem.definitionEn || currentItem.word}
                          </div>
                        </div>

                        {/* Context Preview tool (±5s before and after) */}
                        <ContextPreview
                          video={currentVideo}
                          vocab={currentItem}
                          defaultExpanded={true}
                        />

                        {/* Native audio player to re-listen */}
                        <NativeAudioClipPlayer
                          video={currentVideo}
                          vocab={currentItem}
                          variant="compact"
                        />
                      </div>
                    )}
                  </>
                )}

                {/* 2. THẺ ĐIỀN VÀO CHỖ TRỐNG: Mặt trước: Câu khuyết + Ảnh chụp | Mặt sau: Cụm từ cần học */}
                {cardFormat === 'cloze' && (
                  <>
                    {!isFlipped ? (
                      // Front: Câu gốc có chỗ trống + Hình ảnh chụp từ đoạn video gốc
                      <div className="space-y-4">
                        <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
                          <span className="font-mono text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Thẻ Điền Vào Chỗ Trống · Mặt Trước</span>
                          </span>
                          <span className="text-[11px] text-slate-400">
                            Loại từ: <strong className="text-amber-300">{currentItem.partOfSpeech}</strong>
                          </span>
                        </div>

                        {/* Hình ảnh ngữ cảnh video hoặc gợi ý từ Google Images */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1">
                              {clozeImageTab === 'video' ? (
                                <>
                                  <Camera className="w-3.5 h-3.5 text-amber-400" />
                                  <span>Hình Ảnh Ngữ Cảnh Video:</span>
                                </>
                              ) : (
                                <>
                                  <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                                  <span>Gợi Ý Trực Quan Từ Google Images:</span>
                                </>
                              )}
                            </span>

                            <div className="flex items-center p-0.5 bg-slate-950 rounded-lg border border-slate-800 text-[10px]">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setClozeImageTab('video');
                                }}
                                className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                                  clozeImageTab === 'video'
                                    ? 'bg-amber-400 text-slate-950 font-bold'
                                    : 'text-slate-400 hover:text-white'
                                }`}
                              >
                                Ảnh Video Gốc
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setClozeImageTab('google');
                                }}
                                className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                                  clozeImageTab === 'google'
                                    ? 'bg-amber-400 text-slate-950 font-bold'
                                    : 'text-slate-400 hover:text-white'
                                }`}
                              >
                                Gợi Ý Google Images
                              </button>
                            </div>
                          </div>

                          {clozeImageTab === 'video' ? (
                            <VideoSnapshotFrame
                              video={currentVideo}
                              timestamp={currentItem.timestamp}
                              altText={currentItem.contextSentence}
                            />
                          ) : (
                            <GoogleImageGallery
                              query={currentItem.word}
                              variant="card"
                            />
                          )}
                        </div>

                        {/* Câu gốc có chỗ trống là cụm từ cần học */}
                        <div className="p-4 bg-slate-950/90 rounded-xl border border-slate-800 text-base leading-relaxed text-slate-100 font-medium">
                          "{renderClozeSentence(currentItem.contextSentence, currentItem.word, true)}"
                        </div>

                        {/* Interactive Input form */}
                        <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              placeholder="Nhập cụm từ còn thiếu vào đây..."
                              value={clozeInput}
                              onChange={(e) => setClozeInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  setIsFlipped(true);
                                }
                              }}
                              className="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none font-mono"
                            />
                            <button
                              onClick={() => setIsFlipped(true)}
                              className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl transition-colors cursor-pointer whitespace-nowrap shadow-sm"
                            >
                              Kiểm Tra & Lật Thẻ →
                            </button>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                            <span>Độ dài: {currentItem.word.length} ký tự</span>
                            <button
                              type="button"
                              onClick={() => speakEnglish(currentItem.word)}
                              className="text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Volume2 className="w-3 h-3" />
                              <span>Nghe gợi ý âm thanh</span>
                            </button>
                          </div>

                          {/* Context Preview tool on Cloze front (hint before guessing) */}
                          <div className="pt-1">
                            <ContextPreview
                              video={currentVideo}
                              vocab={currentItem}
                              defaultExpanded={false}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      // Back: Cụm từ cần học + Đánh giá kết quả
                      <div className="space-y-4 animate-fadeIn">
                        <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
                          <span className="font-mono text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5" />
                            <span>Cụm Từ Cần Học · Mặt Sau</span>
                          </span>
                        </div>

                        {/* CỤM TỪ CẦN HỌC */}
                        <div className="p-5 bg-slate-950/80 rounded-xl border border-amber-500/30 flex items-center justify-between gap-4">
                          <div>
                            <span className="text-[11px] uppercase tracking-wider text-amber-400 font-bold block mb-1">
                              Cụm Từ Cần Học (Target Phrase):
                            </span>
                            <div className="text-3xl font-extrabold text-white tracking-tight">
                              {currentItem.word}
                            </div>
                            <div className="text-xs text-slate-400 font-mono mt-1">
                              {currentItem.phonetic} · <span className="italic">{currentItem.partOfSpeech}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => speakEnglish(currentItem.word)}
                            className="p-3 rounded-xl bg-amber-400/20 text-amber-300 hover:bg-amber-400/30 transition-colors cursor-pointer"
                            title="Nghe phát âm"
                          >
                            <Volume2 className="w-6 h-6" />
                          </button>
                        </div>

                        {/* User Answer Evaluation */}
                        {clozeInput.trim() && (
                          <div
                            className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                              clozeInput.trim().toLowerCase() === currentItem.word.trim().toLowerCase()
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                                : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                            }`}
                          >
                            {clozeInput.trim().toLowerCase() === currentItem.word.trim().toLowerCase() ? (
                              <>
                                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                                <span>Chính xác! Bạn đã ghi nhớ đúng từ vựng này.</span>
                              </>
                            ) : (
                              <>
                                <HelpCircle className="w-4 h-4 text-amber-400 shrink-0" />
                                <span>
                                  Bạn đã nhập: <strong className="underline">{clozeInput}</strong> · Đáp án đúng: <strong>{currentItem.word}</strong>
                                </span>
                              </>
                            )}
                          </div>
                        )}

                        {/* Visual anchors: Google Images & Video Snapshot */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <span className="text-[11px] uppercase tracking-wider text-amber-400 font-bold block mb-1.5 flex items-center gap-1">
                              <ImageIcon className="w-3.5 h-3.5" />
                              <span>Ảnh Từ Google Images:</span>
                            </span>
                            <GoogleImageGallery
                              query={currentItem.word}
                              variant="card"
                            />
                          </div>

                          <div>
                            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block mb-1.5 flex items-center gap-1">
                              <Camera className="w-3.5 h-3.5 text-amber-400" />
                              <span>Ảnh Trích Xuất Video Gốc:</span>
                            </span>
                            <VideoSnapshotFrame
                              video={currentVideo}
                              timestamp={currentItem.timestamp}
                              altText={currentItem.contextSentence}
                            />
                          </div>
                        </div>

                        {/* Câu hoàn chỉnh */}
                        <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 text-sm leading-relaxed text-slate-100">
                          <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block mb-1">
                            Câu Hoàn Chỉnh Trong Video:
                          </span>
                          "{renderClozeSentence(currentItem.contextSentence, currentItem.word, false)}"
                        </div>

                        {/* Định nghĩa */}
                        <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800">
                          <span className="text-[11px] uppercase tracking-wider text-amber-400 font-bold block mb-1">
                            Learner's Definition (English):
                          </span>
                          <div className="text-xs text-slate-200 leading-relaxed font-medium">
                            {currentItem.definitionEn || currentItem.word}
                          </div>
                        </div>

                        {/* Context Preview tool (±5s before and after) */}
                        <ContextPreview
                          video={currentVideo}
                          vocab={currentItem}
                          defaultExpanded={true}
                        />

                        {/* Native audio player to reinforce */}
                        <NativeAudioClipPlayer
                          video={currentVideo}
                          vocab={currentItem}
                          variant="compact"
                        />
                      </div>
                    )}
                  </>
                )}

                {/* 3. THẺ CLASSIC: Từ vựng chuẩn */}
                {cardFormat === 'classic' && (
                  <>
                    {/* Front side */}
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-4">
                        <span className="italic">{currentItem.partOfSpeech}</span>
                        {currentItem.videoTitle && (
                          <span className="line-clamp-1 max-w-[200px] text-slate-400">
                            Từ: {currentItem.videoTitle}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <h2 className="text-3xl font-extrabold text-white tracking-tight">{currentItem.word}</h2>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            speakEnglish(currentItem.word);
                          }}
                          className="p-2 rounded-lg bg-amber-400/20 text-amber-300 hover:bg-amber-400/30 transition-colors cursor-pointer"
                          title="Phát âm tiếng Anh"
                        >
                          <Volume2 className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="text-sm text-slate-400 font-mono mt-1">{currentItem.phonetic}</div>

                      <div className="mt-5 p-3.5 bg-slate-950/80 rounded-xl border border-slate-800/80">
                        <div className="text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-1">
                          Ngữ cảnh trong video (Context Sentence):
                        </div>
                        <div className="text-sm text-slate-200 italic">"{currentItem.contextSentence}"</div>
                      </div>

                      {/* Native Video Audio Segment Player */}
                      <NativeAudioClipPlayer
                        video={currentVideo}
                        vocab={currentItem}
                        variant="card"
                      />
                    </div>

                    {/* Back side (Shown when flipped) */}
                    {isFlipped ? (
                      <div className="mt-6 pt-6 border-t border-slate-800 space-y-3 animate-fadeIn">
                        <div>
                          <div className="text-[11px] uppercase tracking-wider text-amber-400 font-bold">
                            Learner's Definition (English):
                          </div>
                          <div className="text-base font-semibold text-white mt-0.5 leading-relaxed">
                            {currentItem.definitionEn || currentItem.word}
                          </div>
                        </div>

                        {/* Visual anchors: Google Images & Video Snapshot */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                          <div>
                            <span className="text-[11px] uppercase tracking-wider text-amber-400 font-bold block mb-1.5 flex items-center gap-1">
                              <ImageIcon className="w-3.5 h-3.5" />
                              <span>Ảnh Từ Google Images:</span>
                            </span>
                            <GoogleImageGallery
                              query={currentItem.word}
                              variant="card"
                            />
                          </div>

                          <div>
                            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block mb-1.5 flex items-center gap-1">
                              <Camera className="w-3.5 h-3.5 text-amber-400" />
                              <span>Ảnh Trích Xuất Video:</span>
                            </span>
                            <VideoSnapshotFrame
                              video={currentVideo}
                              timestamp={currentItem.timestamp}
                              altText={currentItem.contextSentence}
                            />
                          </div>
                        </div>

                        {currentItem.exampleSentence && (
                          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs text-slate-300">
                            <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Example:</span>
                            "{currentItem.exampleSentence}"
                          </div>
                        )}

                        {currentItem.collocations && currentItem.collocations.length > 0 && (
                          <div>
                            <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
                              Cụm từ hay đi kèm (Collocations):
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {currentItem.collocations.map((col, idx) => (
                                <span key={idx} className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                                  {col}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Context Preview tool (±5s before and after) */}
                        <div className="pt-2">
                          <ContextPreview
                            video={currentVideo}
                            vocab={currentItem}
                            defaultExpanded={false}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="mt-6 text-center text-xs text-slate-500">
                        Bấm vào thẻ để xem định nghĩa & hình ảnh
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* SM-2 Rating Buttons */}
              {isFlipped ? (
                <div className="grid grid-cols-4 gap-2 pt-2">
                  <button
                    onClick={() => handleGrade(1)}
                    className="p-3 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 rounded-xl text-center transition-colors cursor-pointer"
                  >
                    <div className="text-xs font-bold">Lại (Again)</div>
                    <div className="text-[10px] text-rose-400/80 mt-0.5">1 ngày</div>
                  </button>

                  <button
                    onClick={() => handleGrade(2)}
                    className="p-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded-xl text-center transition-colors cursor-pointer"
                  >
                    <div className="text-xs font-bold">Khó (Hard)</div>
                    <div className="text-[10px] text-amber-400/80 mt-0.5">1-2 ngày</div>
                  </button>

                  <button
                    onClick={() => handleGrade(3)}
                    className="p-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 rounded-xl text-center transition-colors cursor-pointer"
                  >
                    <div className="text-xs font-bold">Tốt (Good)</div>
                    <div className="text-[10px] text-emerald-400/80 mt-0.5">Tăng giãn</div>
                  </button>

                  <button
                    onClick={() => handleGrade(4)}
                    className="p-3 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-300 rounded-xl text-center transition-colors cursor-pointer"
                  >
                    <div className="text-xs font-bold">Dễ (Easy)</div>
                    <div className="text-[10px] text-blue-400/80 mt-0.5">Khoảng xa</div>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsFlipped(true)}
                  className="w-full py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm rounded-xl transition-colors cursor-pointer shadow-md"
                >
                  Lật Thẻ Xem Đáp Án
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODE 2: VOCABULARY LIST & MANAGEMENT */}
      {mode === 'list' && (
        <div className="space-y-4">
          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm từ vựng hoặc định nghĩa tiếng Anh..."
                className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl text-xs">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  filter === 'all' ? 'bg-amber-400 text-slate-950 font-semibold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Tất cả ({vocabularyList.length})
              </button>
              <button
                onClick={() => setFilter('due')}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  filter === 'due' ? 'bg-amber-400 text-slate-950 font-semibold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Đến hạn ({dueItems.length})
              </button>
              <button
                onClick={() => setFilter('learning')}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  filter === 'learning' ? 'bg-amber-400 text-slate-950 font-semibold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Đang học
              </button>
              <button
                onClick={() => setFilter('mastered')}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  filter === 'mastered' ? 'bg-amber-400 text-slate-950 font-semibold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Đã thuộc
              </button>
            </div>
          </div>

          {/* Table / List */}
          {filteredList.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 bg-slate-900/40 border border-slate-800 rounded-xl">
              Không tìm thấy từ vựng nào khớp với bộ lọc.
            </div>
          ) : (
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl divide-y divide-slate-800/80 overflow-hidden">
              {filteredList.map((item) => {
                const isDue = isDueForReview(item.nextReviewDate);
                const parentVideo = videos.find(
                  (v) =>
                    v.id === item.videoId ||
                    v.youtubeId === item.videoId ||
                    v.title === item.videoTitle
                );

                return (
                  <div
                    key={item.id}
                    className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-800/30 transition-colors"
                  >
                    <div className="flex-1 flex items-start gap-3">
                      {/* Google Image thumbnail */}
                      <GoogleImageGallery query={item.word} variant="thumbnail" />

                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-base font-bold text-white">{item.word}</span>
                          <NativeAudioClipPlayer video={parentVideo} vocab={item} variant="compact" />
                          <span className="text-xs text-slate-400 font-mono">{item.phonetic}</span>
                          <span className="text-xs text-amber-400/90 italic font-medium">{item.partOfSpeech}</span>
                        </div>

                        <div className="text-xs font-semibold text-amber-300/90 mt-1">
                          {item.definitionEn || item.word}
                        </div>

                        <div className="text-xs text-slate-400 italic mt-0.5">"{item.contextSentence}"</div>

                        {item.collocations && item.collocations.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {item.collocations.map((c, idx) => (
                              <span
                                key={idx}
                                className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono"
                              >
                                {c}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Meta & Actions */}
                    <div className="flex items-center gap-3 shrink-0 text-xs">
                      <div className="text-right">
                        <div className="font-mono text-slate-300">
                          {isDue ? (
                            <span className="text-amber-400 font-bold">Cần ôn hôm nay</span>
                          ) : (
                            formatRelativeReview(item.nextReviewDate)
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          Khoảng cách: {item.interval || 1}d
                        </div>
                      </div>

                      {onSelectVideoToPlayById && item.videoId && (
                        <button
                          onClick={() => onSelectVideoToPlayById(item.videoId)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                          title="Mở video chứa từ này"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        onClick={() => onDeleteVocab(item.id)}
                        className="p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                        title="Xóa khỏi sổ từ"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
