import React, { useState, useMemo } from 'react';
import { VideoItem, VocabularyItem, DailyWatchRecord, CEFRLevel } from '../types';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import {
  Clock,
  BookOpen,
  Award,
  Flame,
  Sparkles,
  TrendingUp,
  Play,
  Calendar,
  Layers,
  CheckCircle2,
  BrainCircuit,
  Plus
} from 'lucide-react';
import { addWatchTimeToToday } from '../utils/watchTime';

interface DashboardViewProps {
  videos: VideoItem[];
  vocabularyList: VocabularyItem[];
  watchRecords: DailyWatchRecord[];
  onUpdateWatchRecords: (records: DailyWatchRecord[]) => void;
  onSelectVideoToPlay: (video: VideoItem) => void;
  onNavigateTab: (tab: 'explore' | 'vocab_srs' | 'video_srs') => void;
}

const CEFR_ORDER: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const CEFR_META: Record<CEFRLevel, { label: string; color: string; desc: string }> = {
  A1: { label: 'A1 - Beginner', color: '#38bdf8', desc: 'Từ vựng nền tảng, chào hỏi & đồ vật cơ bản' },
  A2: { label: 'A2 - Elementary', color: '#fbbf24', desc: 'Hội thoại thường ngày, mua sắm & chỉ đường' },
  B1: { label: 'B1 - Intermediate', color: '#34d399', desc: 'Giao tiếp công sở, mô tả kinh nghiệm & ý kiến' },
  B2: { label: 'B2 - Upper Intermediate', color: '#a855f7', desc: 'Ngữ cảnh học thuật, suy luận trừu tượng' },
  C1: { label: 'C1 - Advanced', color: '#f43f5e', desc: 'Ngôn từ chuyên sâu, tinh tế & thành ngữ bản ngữ' },
  C2: { label: 'C2 - Mastery', color: '#ec4899', desc: 'Thành thạo gần như người bản xứ' },
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  videos,
  vocabularyList,
  watchRecords,
  onUpdateWatchRecords,
  onSelectVideoToPlay,
  onNavigateTab,
}) => {
  const [timeRange, setTimeRange] = useState<'7d' | '14d' | '30d'>('7d');
  const [cefrChartType, setCefrChartType] = useState<'stacked' | 'donut'>('stacked');

  // Map words to their parent video CEFR level
  const videoCefrMap = useMemo(() => {
    const map = new Map<string, CEFRLevel>();
    videos.forEach((v) => {
      map.set(v.id, v.cefrLevel);
      map.set(v.youtubeId, v.cefrLevel);
      map.set(v.title, v.cefrLevel);
    });
    return map;
  }, [videos]);

  // Aggregate vocabulary by CEFR level
  const cefrVocabStats = useMemo(() => {
    const counts: Record<CEFRLevel, { mastered: number; learning: number; new: number; total: number }> = {
      A1: { mastered: 0, learning: 0, new: 0, total: 0 },
      A2: { mastered: 0, learning: 0, new: 0, total: 0 },
      B1: { mastered: 0, learning: 0, new: 0, total: 0 },
      B2: { mastered: 0, learning: 0, new: 0, total: 0 },
      C1: { mastered: 0, learning: 0, new: 0, total: 0 },
      C2: { mastered: 0, learning: 0, new: 0, total: 0 },
    };

    vocabularyList.forEach((vocab) => {
      let level: CEFRLevel = 'B1';
      if (videoCefrMap.has(vocab.videoId)) {
        level = videoCefrMap.get(vocab.videoId)!;
      } else if (videoCefrMap.has(vocab.videoTitle)) {
        level = videoCefrMap.get(vocab.videoTitle)!;
      }

      counts[level].total += 1;
      if (vocab.status === 'mastered') {
        counts[level].mastered += 1;
      } else if (vocab.status === 'learning' || vocab.status === 'review') {
        counts[level].learning += 1;
      } else {
        counts[level].new += 1;
      }
    });

    return CEFR_ORDER.map((lvl) => ({
      level: lvl,
      name: lvl,
      label: CEFR_META[lvl].label,
      color: CEFR_META[lvl].color,
      mastered: counts[lvl].mastered,
      learning: counts[lvl].learning,
      new: counts[lvl].new,
      total: counts[lvl].total,
    }));
  }, [vocabularyList, videoCefrMap]);

  // Pie chart data for CEFR distribution (only levels with > 0 words)
  const pieCefrData = useMemo(() => {
    return cefrVocabStats
      .filter((item) => item.total > 0)
      .map((item) => ({
        name: item.level,
        fullName: item.label,
        value: item.total,
        color: item.color,
      }));
  }, [cefrVocabStats]);

  // Daily watch records formatted for Recharts
  const filteredWatchData = useMemo(() => {
    const days = timeRange === '7d' ? 7 : timeRange === '14d' ? 14 : 30;
    const sorted = [...watchRecords].sort((a, b) => a.date.localeCompare(b.date));
    const sliced = sorted.slice(-days);

    return sliced.map((item) => {
      const parts = item.date.split('-');
      const shortDate = parts.length === 3 ? `${parts[2]}/${parts[1]}` : item.date;
      const minutes = Math.round((item.watchTimeSeconds / 60) * 10) / 10;

      return {
        date: item.date,
        shortDate,
        minutes,
        seconds: item.watchTimeSeconds,
        videos: item.videosWatched || 1,
      };
    });
  }, [watchRecords, timeRange]);

  // Overall KPIs
  const totalWatchMinutes = useMemo(() => {
    const totalSecs = watchRecords.reduce((acc, cur) => acc + (cur.watchTimeSeconds || 0), 0);
    return Math.round(totalSecs / 60);
  }, [watchRecords]);

  const totalWatchHours = (totalWatchMinutes / 60).toFixed(1);

  const streakDays = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const sorted = [...watchRecords].sort((a, b) => b.date.localeCompare(a.date));
    let count = 0;
    for (const rec of sorted) {
      if (rec.watchTimeSeconds >= 60) {
        count++;
      } else {
        break;
      }
    }
    return Math.max(1, count);
  }, [watchRecords]);

  const masteredCount = vocabularyList.filter((v) => v.status === 'mastered').length;
  const learningCount = vocabularyList.filter((v) => v.status === 'learning' || v.status === 'review').length;
  const retentionRate = vocabularyList.length > 0
    ? Math.round(((masteredCount + learningCount * 0.7) / vocabularyList.length) * 100)
    : 0;

  const handleSimulateWatch = (minutes: number) => {
    const updated = addWatchTimeToToday(minutes * 60, watchRecords);
    onUpdateWatchRecords(updated);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-amber-400 font-mono mb-1">
            <span>COMPREHENSIBLE INPUT ANALYTICS</span>
            <span aria-hidden="true">·</span>
            <span>KRASHEN i+1 METRICS</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-['Plus_Jakarta_Sans']">
            Bảng Thống Kê Quá Trình Học & Thụ Đắc Ngôn Ngữ
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Theo dõi thời lượng đắm chìm Comprehensible Input mỗi ngày và mật độ từ vựng được ghi nhớ theo từng bậc độ khó CEFR.
          </p>
        </div>

        {/* Quick action button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSimulateWatch(5)}
            className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Ghi nhận thêm 5 phút nghe video hôm nay"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ 5 phút xem hôm nay</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Deck */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Watch Time */}
        <div className="p-5 bg-slate-900/80 border border-slate-800 rounded-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Tổng thời gian nghe video</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-white font-mono">
              {totalWatchHours} <span className="text-sm font-normal text-slate-400">giờ</span>
            </div>
            <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <span className="text-amber-400 font-semibold">{totalWatchMinutes} phút</span>
              <span aria-hidden="true">·</span>
              <span>Input tự nhiên</span>
            </div>
          </div>
        </div>

        {/* Metric 2: Vocabulary Size */}
        <div className="p-5 bg-slate-900/80 border border-slate-800 rounded-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Từ vựng đã lưu SRS</span>
            <BookOpen className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-white font-mono">
              {vocabularyList.length} <span className="text-sm font-normal text-slate-400">từ</span>
            </div>
            <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <span className="text-emerald-400 font-semibold">{masteredCount}</span> đã thuộc
              <span aria-hidden="true">·</span>
              <span className="text-amber-400 font-semibold">{learningCount}</span> đang học
            </div>
          </div>
        </div>

        {/* Metric 3: Active Streak */}
        <div className="p-5 bg-slate-900/80 border border-slate-800 rounded-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Chuỗi ngày duy trì (Streak)</span>
            <Flame className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-rose-400 font-mono">
              {streakDays} <span className="text-sm font-normal text-slate-400">ngày</span>
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Đều đặn mỗi ngày để tạo đà quán tính
            </div>
          </div>
        </div>

        {/* Metric 4: Estimated Retention Rate */}
        <div className="p-5 bg-slate-900/80 border border-slate-800 rounded-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Tỷ lệ ghi nhớ (SM-2)</span>
            <BrainCircuit className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-indigo-400 font-mono">
              {retentionRate}%
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Chống lại đường cong quên lãng
            </div>
          </div>
        </div>
      </div>

      {/* CHART 1: Daily Watch Time (Thời gian xem video mỗi ngày) */}
      <div className="p-6 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-bold text-white">Thời Gian Xem Video Mỗi Ngày (Comprehensible Input)</h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Đo lường thời lượng tiếp nhận âm thanh tiếng Anh bản ngữ theo từng ngày (tính bằng phút).
            </p>
          </div>

          {/* Time range segmented buttons */}
          <div className="flex items-center p-1 bg-slate-950 border border-slate-800 rounded-xl text-xs font-medium">
            <button
              onClick={() => setTimeRange('7d')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                timeRange === '7d' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              7 ngày qua
            </button>
            <button
              onClick={() => setTimeRange('14d')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                timeRange === '14d' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              14 ngày qua
            </button>
            <button
              onClick={() => setTimeRange('30d')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                timeRange === '30d' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              30 ngày qua
            </button>
          </div>
        </div>

        {/* Recharts Area Chart */}
        <div className="h-72 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filteredWatchData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="watchAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="shortDate"
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickLine={false}
              />
              <YAxis
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickLine={false}
                unit="p"
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="p-3 bg-slate-950/95 border border-slate-700 rounded-xl shadow-xl text-xs text-slate-200">
                        <div className="font-semibold text-white mb-1">{data.date}</div>
                        <div className="flex items-center gap-1.5 text-amber-400 font-mono font-bold">
                          <span>Thời gian xem: {data.minutes} phút</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Số video đã tương tác: {data.videos} Short(s)
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <ReferenceLine
                y={20}
                stroke="#10b981"
                strokeDasharray="4 4"
                label={{
                  value: 'Mục tiêu: 20 phút/ngày',
                  fill: '#34d399',
                  fontSize: 11,
                  position: 'insideTopRight',
                }}
              />
              <Area
                type="monotone"
                dataKey="minutes"
                name="Thời gian xem (phút)"
                stroke="#f59e0b"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#watchAreaGradient)"
                activeDot={{ r: 6, fill: '#fbbf24', stroke: '#0f172a', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-800/80">
          <span>* Dữ liệu thời gian được ghi nhận tự động khi phát video Shorts trên hệ thống.</span>
          <span className="text-amber-400/90 font-mono">Đề xuất Krashen: 15-30 phút/ngày</span>
        </div>
      </div>

      {/* CHART 2: Vocabulary by CEFR Level (Số lượng từ vựng đã học theo độ khó CEFR) */}
      <div className="p-6 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-bold text-white">Số Lượng Từ Vựng Theo Độ Khó CEFR (A1 - C2)</h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Phân bố từ vựng đã lưu trong sổ SRS theo từng nấc thang thông thạo châu Âu (CEFR Framework).
            </p>
          </div>

          {/* Toggle between Stacked Bar and Donut View */}
          <div className="flex items-center p-1 bg-slate-950 border border-slate-800 rounded-xl text-xs font-medium">
            <button
              onClick={() => setCefrChartType('stacked')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                cefrChartType === 'stacked' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Cột phân loại (Bar)
            </button>
            <button
              onClick={() => setCefrChartType('donut')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                cefrChartType === 'donut' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Tỷ lệ tròn (Donut)
            </button>
          </div>
        </div>

        {/* Chart Container */}
        {cefrChartType === 'stacked' ? (
          <div className="h-80 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cefrVocabStats} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="level"
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
                  tickLine={false}
                />
                <YAxis
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="p-3 bg-slate-950/95 border border-slate-700 rounded-xl shadow-xl text-xs space-y-1">
                          <div className="font-bold text-white mb-1.5 flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }} />
                            <span>Trình độ {data.label}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4 text-emerald-400">
                            <span>Đã thành thạo:</span>
                            <span className="font-mono font-bold">{data.mastered}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4 text-amber-400">
                            <span>Đang học / Ôn tập:</span>
                            <span className="font-mono font-bold">{data.learning}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4 text-sky-400">
                            <span>Mới lưu:</span>
                            <span className="font-mono font-bold">{data.new}</span>
                          </div>
                          <div className="pt-1 mt-1 border-t border-slate-800 flex items-center justify-between font-bold text-white">
                            <span>Tổng cộng:</span>
                            <span className="font-mono">{data.total} từ</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend
                  wrapperStyle={{ paddingTop: 12 }}
                  formatter={(value) => {
                    if (value === 'mastered') return <span className="text-xs text-slate-300">Đã thành thạo</span>;
                    if (value === 'learning') return <span className="text-xs text-slate-300">Đang học / Ôn tập</span>;
                    if (value === 'new') return <span className="text-xs text-slate-300">Mới lưu</span>;
                    return value;
                  }}
                />
                <Bar dataKey="mastered" name="mastered" fill="#10b981" stackId="a" radius={[0, 0, 0, 0]} />
                <Bar dataKey="learning" name="learning" fill="#f59e0b" stackId="a" radius={[0, 0, 0, 0]} />
                <Bar dataKey="new" name="new" fill="#38bdf8" stackId="a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 items-center gap-6 pt-4">
            <div className="md:col-span-6 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieCefrData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieCefrData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="#0f172a" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="p-2.5 bg-slate-950 border border-slate-700 rounded-lg text-xs shadow-xl">
                            <span className="font-bold text-white">{data.fullName}</span>
                            <div className="font-mono text-amber-400 mt-0.5">{data.value} từ vựng</div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Donut Legend Cards */}
            <div className="md:col-span-6 space-y-2">
              {cefrVocabStats.map((item) => (
                <div
                  key={item.level}
                  className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="font-semibold text-white">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400 font-mono">
                      {item.total > 0
                        ? `${Math.round((item.total / Math.max(1, vocabularyList.length)) * 100)}%`
                        : '0%'}
                    </span>
                    <span className="font-mono font-bold text-white bg-slate-800 px-2 py-0.5 rounded">
                      {item.total} từ
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* CEFR Level Breakdown Cards Detail */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
          Chi Tiết Trình Độ CEFR Theo Nguyên Lý Krashen i+1
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cefrVocabStats.map((item) => {
            const levelVideos = videos.filter((v) => v.cefrLevel === item.level);
            return (
              <div
                key={item.level}
                className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-3 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="px-2 py-0.5 rounded text-xs font-mono font-bold text-slate-950"
                      style={{ backgroundColor: item.color }}
                    >
                      {item.level}
                    </span>
                    <span className="text-xs font-bold text-white">{item.label}</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-white bg-slate-800 px-2 py-0.5 rounded">
                    {item.total} từ
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {CEFR_META[item.level].desc}
                </p>

                {/* Progress bar of mastery */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>Đã thành thạo: {item.mastered}/{item.total}</span>
                    <span>{item.total > 0 ? Math.round((item.mastered / item.total) * 100) : 0}%</span>
                  </div>
                  <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 transition-all duration-300"
                      style={{
                        width: `${item.total > 0 ? (item.mastered / item.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Related videos available */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Video nguồn: {levelVideos.length} bài</span>
                  {levelVideos.length > 0 && (
                    <button
                      onClick={() => onSelectVideoToPlay(levelVideos[0])}
                      className="text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold cursor-pointer"
                    >
                      <Play className="w-3 h-3 fill-amber-400" />
                      <span>Học ngay</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
