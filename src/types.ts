export interface SubtitleItem {
  id: string;
  start: number; // in seconds
  end: number;   // in seconds
  text: string;
}

export interface VocabularyItem {
  id: string;
  word: string;
  phonetic: string;
  partOfSpeech: string;
  definitionEn: string;
  contextSentence: string;
  exampleSentence: string;
  collocations: string[];
  timestamp: number;
  videoId: string;
  videoTitle: string;
  
  // Spaced Repetition (SM-2 / Leitner)
  interval: number; // in days
  repetition: number;
  easeFactor: number;
  nextReviewDate: string; // ISO string
  lastReviewedDate?: string;
  status: 'new' | 'learning' | 'review' | 'mastered';
  reviewHistory?: { date: string; grade: number }[];
}

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface VideoItem {
  id: string;
  youtubeId: string;
  youtubeUrl: string;
  title: string;
  channel: string;
  thumbnail: string;
  topic: string;
  cefrLevel: CEFRLevel;
  cefrReason: string;
  summary: string;
  subtitles: SubtitleItem[];
  suggestedVocab: VocabularyItem[];
  comprehensibilityTips: string[];
  duration: number;
  addedAt: string;

  // Video SRS Tracking
  inSrs: boolean;
  srsStage: number; // 1: Nghe hiểu cốt lõi, 2: Ẩn phụ đề, 3: Shadowing luyện nói, 4: Ôn tập củng cố
  srsNextReviewDate?: string;
  srsLastReviewDate?: string;
  srsInterval?: number; // days
  srsRepetition?: number;
  notes?: string;
}

export interface AnalyzeVideoRequest {
  url: string;
  rawTranscript?: string;
  customTitle?: string;
}

export interface AnalyzeVideoResponse {
  success: boolean;
  video?: VideoItem;
  error?: string;
}

export interface DailyWatchRecord {
  date: string; // YYYY-MM-DD
  watchTimeSeconds: number; // in seconds
  videosWatched: number;
}
