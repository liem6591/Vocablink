import React, { useState } from 'react';
import { VideoItem, VocabularyItem } from '../types';
import { Youtube, Sparkles, AlertCircle, Check, Loader2, ArrowRight, BookPlus, Volume2, Clock } from 'lucide-react';
import { speakEnglish } from '../utils/speech';

interface AdminImportViewProps {
  onSaveVideo: (video: VideoItem) => void;
  onAddVocabToSRS: (vocab: VocabularyItem) => void;
  savedVocabIds: Set<string>;
  onSelectVideoToPlay: (video: VideoItem) => void;
}

const SAMPLE_SHORT_LINKS = [
  {
    title: 'Ordering Coffee like a Pro',
    url: 'https://www.youtube.com/shorts/3e_a0E4Uq8k',
    label: 'Coffee Shop A2',
  },
  {
    title: 'British vs American Slang',
    url: 'https://www.youtube.com/shorts/Wv2rLZmbPMA',
    label: 'Pronunciation B1',
  },
  {
    title: '5 Habits for Focus',
    url: 'https://www.youtube.com/shorts/kJQP7kiw5Fk',
    label: 'Productivity B2',
  },
];

export const AdminImportView: React.FC<AdminImportViewProps> = ({
  onSaveVideo,
  onAddVocabToSRS,
  savedVocabIds,
  onSelectVideoToPlay,
}) => {
  const [url, setUrl] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [rawTranscript, setRawTranscript] = useState('');
  const [showAdvancedTranscript, setShowAdvancedTranscript] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyzedVideo, setAnalyzedVideo] = useState<VideoItem | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleAnalyze = async (targetUrl?: string) => {
    const inputUrl = (targetUrl || url).trim();
    if (!inputUrl) {
      setError('Vui lòng dán đường link video YouTube Short.');
      return;
    }

    setLoading(true);
    setError(null);
    setAnalyzedVideo(null);
    setSavedSuccess(false);

    try {
      const res = await fetch('/api/analyze-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: inputUrl,
          rawTranscript: rawTranscript.trim() || undefined,
          customTitle: customTitle.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Không thể phân tích video này.');
      }

      setAnalyzedVideo(data.video);
    } catch (err: any) {
      setError(err?.message || 'Có lỗi xảy ra trong quá trình xử lý video với AI.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToLibrary = () => {
    if (!analyzedVideo) return;
    onSaveVideo(analyzedVideo);
    setSavedSuccess(true);
  };

  const handleSaveAndPlay = () => {
    if (!analyzedVideo) return;
    onSaveVideo(analyzedVideo);
    onSelectVideoToPlay(analyzedVideo);
  };

  const handleAddAllVocab = () => {
    if (!analyzedVideo) return;
    analyzedVideo.suggestedVocab.forEach((vocab) => {
      onAddVocabToSRS(vocab);
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Editorial Title */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs text-amber-400 font-mono mb-2">
          <span>AI COMPREHENSIBLE INPUT PIPELINE</span>
          <span aria-hidden="true">·</span>
          <span>GEMINI 3.8 FLASH</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-['Plus_Jakarta_Sans']">
          Nhập YouTube Short & Tách Phụ Đề Timestamp Tự Động
        </h1>
        <p className="mt-2 text-sm text-slate-400 max-w-2xl leading-relaxed">
          Dán link bất kỳ một video YouTube Short dạy giao tiếp hoặc đời thường. Hệ thống tự động trích xuất phụ đề, đồng bộ mốc thời gian (timestamp), đo lường độ khó CEFR theo nguyên lý Krashen i+1 và trích xuất từ vựng vào SRS.
        </p>
      </div>

      {/* Main Form Box */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 sm:p-6 mb-8">
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
          Đường dẫn YouTube Short hoặc Video
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Youtube className="w-5 h-5 text-rose-500" />
            </div>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/shorts/..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
            />
          </div>
          <button
            onClick={() => handleAnalyze()}
            disabled={loading}
            className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 disabled:bg-slate-700 text-slate-950 font-semibold text-sm rounded-lg transition-colors flex items-center justify-center gap-2 whitespace-nowrap shadow-sm active:scale-95 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                <span>Đang phân tích AI...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-slate-950" />
                <span>Tách Sub & Phân Tích</span>
              </>
            )}
          </button>
        </div>

        {/* Quick sample chips */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span className="text-slate-500">Mẫu thử nhanh:</span>
          {SAMPLE_SHORT_LINKS.map((sample, idx) => (
            <button
              key={idx}
              onClick={() => {
                setUrl(sample.url);
                handleAnalyze(sample.url);
              }}
              className="text-slate-300 hover:text-amber-400 transition-colors underline decoration-slate-700 underline-offset-4 cursor-pointer"
            >
              {sample.label}
            </button>
          ))}
        </div>

        {/* Optional transcript collapsible */}
        <div className="mt-4 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={() => setShowAdvancedTranscript(!showAdvancedTranscript)}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span>{showAdvancedTranscript ? '− Ẩn tùy chọn nâng cao' : '+ Nhập phụ đề thô thủ công (nếu muốn độ chính xác 100%)'}</span>
          </button>

          {showAdvancedTranscript && (
            <div className="mt-3 space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Tiêu đề tùy chỉnh (tùy chọn):</label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="Ví dụ: Cách gọi món cà phê chuẩn bản xứ..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Đoạn thoại tiếng Anh thô (Hệ thống sẽ tự động đối chiếu, căn chỉnh timestamp từng câu):
                </label>
                <textarea
                  value={rawTranscript}
                  onChange={(e) => setRawTranscript(e.target.value)}
                  rows={3}
                  placeholder="Dán toàn bộ lời thoại vào đây nếu bạn đã có sẵn..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-rose-300 text-sm">
          <div className="flex items-start gap-3 flex-1">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-rose-200">Không thể phân tích video lúc này</p>
              <p className="mt-0.5 text-xs text-rose-300/90 leading-relaxed">
                {(() => {
                  try {
                    const parsed = JSON.parse(error);
                    if (parsed?.error?.message) {
                      if (parsed.error.code === 503 || parsed.error.status === 'UNAVAILABLE') {
                        return 'Máy chủ Google AI đang tiếp nhận lưu lượng cao đột xuất (503 High Demand). Vui lòng bấm nút "Thử lại ngay" bên cạnh để hệ thống tự động thử với mô hình dự phòng.';
                      }
                      return parsed.error.message;
                    }
                  } catch (_) {}
                  if (error.includes('503') || error.includes('UNAVAILABLE') || error.includes('high demand')) {
                    return 'Máy chủ Google AI đang tiếp nhận lưu lượng cao đột xuất (503 High Demand). Vui lòng bấm nút "Thử lại ngay" bên cạnh để hệ thống tự động chuyển mô hình dự phòng.';
                  }
                  return error;
                })()}
              </p>
            </div>
          </div>

          <button
            onClick={() => handleAnalyze()}
            disabled={loading}
            className="px-3.5 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-rose-300" />
            <span>Thử lại ngay</span>
          </button>
        </div>
      )}

      {/* Loading state visual indicator */}
      {loading && (
        <div className="py-12 flex flex-col items-center justify-center text-center space-y-3 bg-slate-900/40 border border-slate-800/80 rounded-xl">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
          <div className="text-sm font-medium text-slate-200">Gemini đang phân tích lời thoại, chia timestamp và đo lường CEFR...</div>
          <div className="text-xs text-slate-500 max-w-sm">
            Áp dụng mô hình Krashen Comprehensible Input để trích lọc từ vựng then chốt và cụm từ tự nhiên.
          </div>
        </div>
      )}

      {/* Analysis Result */}
      {analyzedVideo && !loading && (
        <div className="space-y-6">
          {/* Success Banner */}
          <div className="p-4 bg-slate-900/90 border border-slate-700/80 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold mb-1">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Phân tích thành công</span>
                <span className="text-slate-500">·</span>
                <span className="text-slate-300">{analyzedVideo.subtitles.length} câu phụ đề</span>
                <span className="text-slate-500">·</span>
                <span className="text-slate-300">{analyzedVideo.suggestedVocab.length} từ vựng then chốt</span>
              </div>
              <h2 className="text-base font-bold text-white line-clamp-1">{analyzedVideo.title}</h2>
              <p className="text-xs text-slate-400">Kênh: {analyzedVideo.channel}</p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleSaveToLibrary}
                disabled={savedSuccess}
                className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors flex items-center gap-1.5"
              >
                {savedSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Đã lưu vào Thư viện</span>
                  </>
                ) : (
                  <span>Lưu Thư Viện</span>
                )}
              </button>

              <button
                onClick={handleSaveAndPlay}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <span>Học Ngay Trên Player</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-950" />
              </button>
            </div>
          </div>

          {/* CEFR and Topic Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
              <div className="text-xs text-slate-400 mb-1">Độ khó CEFR</div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-amber-400 font-mono">{analyzedVideo.cefrLevel}</span>
                <span className="text-xs px-2 py-0.5 bg-amber-500/10 text-amber-300 rounded border border-amber-500/20 font-medium">
                  {analyzedVideo.cefrLevel === 'A1'
                    ? 'Beginner'
                    : analyzedVideo.cefrLevel === 'A2'
                    ? 'Elementary'
                    : analyzedVideo.cefrLevel === 'B1'
                    ? 'Intermediate'
                    : analyzedVideo.cefrLevel === 'B2'
                    ? 'Upper Intermediate'
                    : 'Advanced'}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">{analyzedVideo.cefrReason}</p>
            </div>

            <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
              <div className="text-xs text-slate-400 mb-1">Chủ đề (Topic)</div>
              <div className="text-base font-bold text-white mb-2">{analyzedVideo.topic}</div>
              <p className="text-xs text-slate-400 leading-relaxed">{analyzedVideo.summary}</p>
            </div>

            <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
              <div className="text-xs text-slate-400 mb-1">Mẹo Comprehensible Input</div>
              <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                {analyzedVideo.comprehensibilityTips.map((tip, idx) => (
                  <li key={idx} className="leading-snug">
                    <span className="text-slate-300">{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Section: Suggested Vocab & Collocations */}
          <div className="p-5 bg-slate-900/80 border border-slate-800 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <BookPlus className="w-4 h-4 text-emerald-400" />
                  <span>Từ Vựng & Cụm Từ Được Đề Xuất Học ({analyzedVideo.suggestedVocab.length})</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Bấm để chọn từ vựng muốn lưu vào Sổ học cá nhân theo phương pháp lặp lại ngắt quãng (SRS).
                </p>
              </div>

              <button
                onClick={handleAddAllVocab}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition-colors"
              >
                + Thêm tất cả vào SRS
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {analyzedVideo.suggestedVocab.map((vocab) => {
                const isAdded = savedVocabIds.has(vocab.id);
                return (
                  <div
                    key={vocab.id}
                    className={`p-3.5 rounded-lg border transition-all ${
                      isAdded
                        ? 'bg-emerald-950/20 border-emerald-500/40 text-slate-200'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">{vocab.word}</span>
                          <button
                            onClick={() => speakEnglish(vocab.word)}
                            className="p-1 text-slate-400 hover:text-amber-400 transition-colors"
                            title="Phát âm tiếng Anh chuẩn"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs text-slate-400 font-mono">{vocab.phonetic}</span>
                        </div>
                        <span className="text-[11px] text-amber-400 italic">{vocab.partOfSpeech}</span>
                      </div>

                      <button
                        onClick={() => onAddVocabToSRS(vocab)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                          isAdded
                            ? 'bg-emerald-500/20 text-emerald-300 cursor-default'
                            : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                        }`}
                      >
                        {isAdded ? '✓ Đã lưu SRS' : '+ Thêm vào SRS'}
                      </button>
                    </div>

                    <div className="mt-2 text-xs font-medium text-amber-300/90">
                      {vocab.definitionEn || vocab.word}
                    </div>

                    <div className="mt-1.5 text-xs text-slate-400 italic border-l-2 border-slate-700 pl-2">
                      "{vocab.contextSentence}"
                    </div>

                    {vocab.collocations && vocab.collocations.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-800/80 flex flex-wrap gap-1">
                        {vocab.collocations.map((col, idx) => (
                          <span
                            key={idx}
                            className="text-[11px] px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-300 font-mono"
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

          {/* Section: Timestamped Subtitles */}
          <div className="p-5 bg-slate-900/80 border border-slate-800 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-400" />
                  <span>Phụ Đề Tách Theo Mốc Thời Gian (Timestamps)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Mỗi câu được chia nhỏ từ 3 đến 6 giây để tai tiếp nạp Comprehensible Input dễ dàng nhất.
                </p>
              </div>
            </div>

            <div className="divide-y divide-slate-800/80 max-h-96 overflow-y-auto pr-1">
              {analyzedVideo.subtitles.map((sub, index) => {
                const formatTime = (sec: number) => {
                  const m = Math.floor(sec / 60);
                  const s = Math.floor(sec % 60);
                  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                };

                return (
                  <div key={sub.id || index} className="py-2.5 flex items-start gap-3 hover:bg-slate-800/30 px-2 rounded">
                    <span className="text-xs font-mono text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded shrink-0">
                      {formatTime(sub.start)} - {formatTime(sub.end)}
                    </span>
                    <div className="flex-1 text-xs">
                      <div className="text-slate-100 font-medium">{sub.text}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
