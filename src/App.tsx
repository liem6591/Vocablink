import React, { useState, useEffect } from 'react';
import { Header, NavTab } from './components/Header';
import { VideoGridView } from './components/VideoGridView';
import { VideoPlayerView } from './components/VideoPlayerView';
import { AdminImportView } from './components/AdminImportView';
import { VocabSRSView } from './components/VocabSRSView';
import { VideoSRSView } from './components/VideoSRSView';
import { GraphView } from './components/GraphView';
import { DashboardView } from './components/DashboardView';
import { VideoItem, VocabularyItem, DailyWatchRecord } from './types';
import { INITIAL_VIDEOS } from './data/initialVideos';
import { isDueForReview, calculateNextVideoSRS } from './utils/srs';
import { loadWatchRecords, addWatchTimeToToday, saveWatchRecords } from './utils/watchTime';

const STORAGE_KEY_VIDEOS = 'lingopulse_videos_v2';
const STORAGE_KEY_VOCAB = 'lingopulse_vocab_v2';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('explore');
  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);

  // Initialize daily watch records
  const [watchRecords, setWatchRecords] = useState<DailyWatchRecord[]>(() => loadWatchRecords());

  // Initialize videos from localStorage or INITIAL_VIDEOS
  const [videos, setVideos] = useState<VideoItem[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_VIDEOS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed to load stored videos:', e);
    }
    return INITIAL_VIDEOS;
  });

  // Initialize vocabulary list from localStorage or pre-loaded items
  const [vocabularyList, setVocabularyList] = useState<VocabularyItem[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_VOCAB);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Failed to load stored vocab:', e);
    }
    // Default initial saved vocabularies from initial videos
    const initialVocab: VocabularyItem[] = [];
    INITIAL_VIDEOS.forEach((v) => {
      v.suggestedVocab.forEach((voc) => {
        initialVocab.push(voc);
      });
    });
    return initialVocab;
  });

  // Save changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_VIDEOS, JSON.stringify(videos));
    } catch (e) {
      console.warn('Storage save failed:', e);
    }
  }, [videos]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_VOCAB, JSON.stringify(vocabularyList));
    } catch (e) {
      console.warn('Storage save failed:', e);
    }
  }, [vocabularyList]);

  // Set of saved vocab IDs for fast lookup
  const savedVocabIds = new Set(vocabularyList.map((v) => v.id));

  // Count due reviews
  const vocabDueCount = vocabularyList.filter((v) => isDueForReview(v.nextReviewDate)).length;
  const videoDueCount = videos.filter((v) => v.inSrs && isDueForReview(v.srsNextReviewDate)).length;

  // Handlers
  const handleAddVocabToSRS = (vocab: VocabularyItem) => {
    if (savedVocabIds.has(vocab.id)) return;
    const newItem: VocabularyItem = {
      ...vocab,
      interval: 1,
      repetition: 0,
      easeFactor: 2.5,
      nextReviewDate: new Date().toISOString(),
      status: 'new',
    };
    setVocabularyList((prev) => [newItem, ...prev]);
  };

  const handleUpdateVocab = (updatedVocab: VocabularyItem) => {
    setVocabularyList((prev) =>
      prev.map((item) => (item.id === updatedVocab.id ? updatedVocab : item))
    );
  };

  const handleAddWatchTime = (seconds: number) => {
    setWatchRecords((prev) => addWatchTimeToToday(seconds, prev));
  };

  const handleDeleteVocab = (vocabId: string) => {
    setVocabularyList((prev) => prev.filter((v) => v.id !== vocabId));
  };

  const handleSaveNewVideo = (newVideo: VideoItem) => {
    setVideos((prev) => {
      const exists = prev.some((v) => v.id === newVideo.id || v.youtubeId === newVideo.youtubeId);
      if (exists) {
        return prev.map((v) =>
          v.id === newVideo.id || v.youtubeId === newVideo.youtubeId ? newVideo : v
        );
      }
      return [newVideo, ...prev];
    });
  };

  const handleToggleVideoSRS = (videoId: string) => {
    setVideos((prev) =>
      prev.map((v) => {
        if (v.id === videoId) {
          const nextInSrs = !v.inSrs;
          return {
            ...v,
            inSrs: nextInSrs,
            srsStage: nextInSrs ? v.srsStage || 1 : v.srsStage,
            srsNextReviewDate: nextInSrs ? new Date().toISOString() : v.srsNextReviewDate,
          };
        }
        return v;
      })
    );
    if (selectedVideo && selectedVideo.id === videoId) {
      setSelectedVideo((prev) =>
        prev
          ? {
              ...prev,
              inSrs: !prev.inSrs,
              srsStage: !prev.inSrs ? prev.srsStage || 1 : prev.srsStage,
            }
          : null
      );
    }
  };

  const handleCompleteVideoStage = (videoId: string, stage: number) => {
    setVideos((prev) =>
      prev.map((v) => {
        if (v.id === videoId) {
          const result = calculateNextVideoSRS(v, stage);
          return {
            ...v,
            ...result,
            srsLastReviewDate: new Date().toISOString(),
          };
        }
        return v;
      })
    );

    if (selectedVideo && selectedVideo.id === videoId) {
      const result = calculateNextVideoSRS(selectedVideo, stage);
      setSelectedVideo((prev) => (prev ? { ...prev, ...result } : null));
    }
  };

  const handleSelectVideoToPlay = (video: VideoItem) => {
    setSelectedVideo(video);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectVideoToPlayById = (videoId: string) => {
    const found = videos.find((v) => v.id === videoId);
    if (found) {
      handleSelectVideoToPlay(found);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Bar Header */}
      <Header
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          if (tab !== 'explore') {
            setSelectedVideo(null);
          }
        }}
        vocabDueCount={vocabDueCount}
        videoDueCount={videoDueCount}
        onOpenImport={() => {
          setActiveTab('admin');
          setSelectedVideo(null);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {selectedVideo ? (
          <VideoPlayerView
            video={selectedVideo}
            onBack={() => setSelectedVideo(null)}
            onAddVocabToSRS={handleAddVocabToSRS}
            savedVocabIds={savedVocabIds}
            onToggleVideoSRS={handleToggleVideoSRS}
            onCompleteVideoStage={handleCompleteVideoStage}
            onAddWatchTime={handleAddWatchTime}
          />
        ) : (
          <>
            {activeTab === 'explore' && (
              <VideoGridView
                videos={videos}
                onSelectVideo={handleSelectVideoToPlay}
                onOpenImport={() => setActiveTab('admin')}
                onToggleVideoSRS={handleToggleVideoSRS}
                onOpenGraph={() => setActiveTab('graph')}
                onOpenDashboard={() => setActiveTab('dashboard')}
              />
            )}

            {activeTab === 'dashboard' && (
              <DashboardView
                videos={videos}
                vocabularyList={vocabularyList}
                watchRecords={watchRecords}
                onUpdateWatchRecords={(newRecords) => setWatchRecords(newRecords)}
                onSelectVideoToPlay={handleSelectVideoToPlay}
                onNavigateTab={(tab) => {
                  setActiveTab(tab);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            )}

            {activeTab === 'graph' && (
              <GraphView
                videos={videos}
                vocabularyList={vocabularyList}
                onSelectVideoToPlay={(vid) => {
                  handleSelectVideoToPlay(vid);
                }}
                onAddVocabToSRS={handleAddVocabToSRS}
                savedVocabIds={savedVocabIds}
              />
            )}

            {activeTab === 'admin' && (
              <AdminImportView
                onSaveVideo={handleSaveNewVideo}
                onAddVocabToSRS={handleAddVocabToSRS}
                savedVocabIds={savedVocabIds}
                onSelectVideoToPlay={(vid) => {
                  setSelectedVideo(vid);
                  setActiveTab('explore');
                }}
              />
            )}

            {activeTab === 'vocab_srs' && (
              <VocabSRSView
                vocabularyList={vocabularyList}
                videos={videos}
                onUpdateVocab={handleUpdateVocab}
                onDeleteVocab={handleDeleteVocab}
                onSelectVideoToPlayById={handleSelectVideoToPlayById}
              />
            )}

            {activeTab === 'video_srs' && (
              <VideoSRSView
                videos={videos}
                onSelectVideoToPlay={(vid) => {
                  handleSelectVideoToPlay(vid);
                }}
                onToggleVideoSRS={handleToggleVideoSRS}
                onCompleteVideoStage={handleCompleteVideoStage}
                onBrowseLibrary={() => setActiveTab('explore')}
              />
            )}
          </>
        )}
      </main>

      {/* Quiet Footer without mechanical telemetry */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-300">Vocablink</span>
            <span aria-hidden="true">·</span>
            <span>Phương pháp Comprehensible Input & Lặp lại ngắt quãng (SRS)</span>
          </div>
          <div className="text-[11px] text-slate-500">
            Dựa trên mô hình tiếp nạp ngôn ngữ i+1 của Giáo sư Stephen Krashen & thuật toán SuperMemo SM-2.
          </div>
        </div>
      </footer>
    </div>
  );
}
