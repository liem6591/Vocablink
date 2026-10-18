import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Initialize GoogleGenAI client (Server-side only)
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Helper to extract YouTube ID
function extractYouTubeId(urlOrId: string): string | null {
  if (!urlOrOrClean(urlOrId)) return null;
  const str = urlOrId.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(str)) {
    return str;
  }
  const shortsRegex = /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/;
  const shortsMatch = str.match(shortsRegex);
  if (shortsMatch) return shortsMatch[1];

  const watchRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = str.match(watchRegex);
  if (match) return match[1];

  return null;
}

function urlOrOrClean(str: string): boolean {
  return typeof str === 'string' && str.trim().length > 0;
}

// Robust Gemini generation with working fallback models and retry on 503/429
const CANDIDATE_MODELS = [
  'gemini-3.5-flash',
  'gemini-3-flash-preview',
  'gemini-3.1-flash-lite-preview',
  'gemini-3.8-flash',
];

async function generateWithFallback(prompt: string, responseMimeType?: string) {
  let lastError: any = null;

  for (const model of CANDIDATE_MODELS) {
    // Try up to 2 attempts per model with backoff if 503/429
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const config: any = {};
        if (responseMimeType) {
          config.responseMimeType = responseMimeType;
        }

        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config,
        });

        if (response && response.text) {
          return { text: response.text, modelUsed: model };
        }
      } catch (err: any) {
        lastError = err;
        const errMsg = String(err?.message || err || '');
        const isTemporary = errMsg.includes('503') || errMsg.includes('UNAVAILABLE') || errMsg.includes('high demand') || errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED');
        
        console.warn(`[AI Warning] Model ${model} attempt ${attempt + 1} failed: ${errMsg.slice(0, 120)}...`);

        if (isTemporary && attempt === 0) {
          // Wait 1.2s before quick retry on the same model
          await new Promise((r) => setTimeout(r, 1200));
        } else {
          // Move to next model in candidates
          break;
        }
      }
    }
  }

  throw lastError;
}
app.post('/api/analyze-video', async (req, res) => {
  try {
    const { url, rawTranscript, customTitle } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, error: 'Vui lòng cung cấp đường link YouTube.' });
    }

    const videoId = extractYouTubeId(url);
    if (!videoId) {
      return res.status(400).json({
        success: false,
        error: 'Đường dẫn YouTube không hợp lệ. Vui lòng nhập link YouTube Short (ví dụ: https://www.youtube.com/shorts/...) hoặc video thông thường.',
      });
    }

    // Attempt to fetch public metadata from YouTube oEmbed
    let videoTitle = customTitle || '';
    let authorName = 'YouTube Creator';
    let thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

    try {
      const oembedRes = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
        { signal: AbortSignal.timeout(3500) }
      );
      if (oembedRes.ok) {
        const oembedData = await oembedRes.json();
        if (oembedData.title) videoTitle = customTitle || oembedData.title;
        if (oembedData.author_name) authorName = oembedData.author_name;
        if (oembedData.thumbnail_url) thumbnailUrl = oembedData.thumbnail_url;
      }
    } catch (e) {
      console.warn('oEmbed fetch skipped or timed out:', e);
    }

    const prompt = `
Bạn là chuyên gia ngôn ngữ học ứng dụng và phương pháp thụ đắc ngôn ngữ tự nhiên (Comprehensible Input - Krashen i+1) kiêm giáo viên tiếng Anh cao cấp.
Nhiệm vụ: Phân tích video YouTube Short dạy/nói tiếng Anh sau đây hoàn toàn bằng tiếng Anh và phương pháp Comprehensible Input thuần túy (không dịch nghĩa tiếng Việt):
- YouTube ID: ${videoId}
- YouTube Link: https://www.youtube.com/shorts/${videoId}
- Tiêu đề video: ${videoTitle || 'English Conversation Short'}
- Kênh: ${authorName}
${rawTranscript ? `\n- Phụ đề thô / Transcript do người dùng cung cấp:\n"""\n${rawTranscript}\n"""` : ''}

Hãy thực hiện:
1. Tách phụ đề theo mốc thời gian (timestamp in seconds):
   - Chia thành từng câu hoặc cụm câu ngắn gọn tự nhiên theo nhịp nói (mỗi đoạn từ 3 - 6 giây, tổng thời lượng Short thường 30 - 60 giây).
   - Mỗi đoạn có: start (giây), end (giây), text (tiếng Anh chuẩn). Tuyệt đối KHÔNG dịch tiếng Việt.
2. Xác định chủ đề (topic) bằng tiếng Anh hoặc song ngữ ngắn gọn (ví dụ: "Ordering Coffee at a Cafe", "Everyday Idioms", "Overcoming Procrastination").
3. Xác định độ khó CEFR: 'A1' | 'A2' | 'B1' | 'B2' | 'C1'.
4. Nêu lý do xác định trình độ (cefrReason): Giải thích dựa trên tốc độ nói, mật độ từ vựng, cấu trúc câu theo nguyên lý Comprehensible Input (i+1).
5. Tóm tắt nội dung video (summary) súc tích bằng tiếng Anh (1-2 câu).
6. Gợi ý các từ vựng & cụm từ (collocations/phrasal verbs/idioms) then chốt trong video (từ 3 đến 6 từ):
   - word: từ hoặc cụm từ
   - phonetic: phiên âm quốc tế IPA (ví dụ: /kənˈsɪstəntli/)
   - partOfSpeech: loại từ (noun, verb, phrasal verb, idiom, adjective...)
   - definitionEn: định nghĩa súc tích bằng tiếng Anh đơn giản (Learner's English definition, dễ hiểu theo Krashen i+1, không dùng tiếng Việt)
   - contextSentence: câu xuất hiện trong video
   - exampleSentence: một câu ví dụ khác trong đời sống thực tế
   - collocations: mảng 2-4 cụm từ hay đi kèm
   - timestamp: số giây tương đối trong video khi từ này xuất hiện
7. Đưa ra 3 lời khuyên tiếp nhận Comprehensible Input (comprehensibilityTips) cho người học khi xem video này.

Trả về ĐÚNG định dạng JSON nguyên bản (không markdown code block, hoặc JSON thuần):
{
  "title": string,
  "topic": string,
  "cefrLevel": "A1" | "A2" | "B1" | "B2" | "C1",
  "cefrReason": string,
  "summary": string,
  "comprehensibilityTips": string[],
  "duration": number,
  "subtitles": [
    {
      "id": string,
      "start": number,
      "end": number,
      "text": string
    }
  ],
  "suggestedVocab": [
    {
      "id": string,
      "word": string,
      "phonetic": string,
      "partOfSpeech": string,
      "definitionEn": string,
      "contextSentence": string,
      "exampleSentence": string,
      "collocations": string[],
      "timestamp": number
    }
  ]
}
`;

    const { text, modelUsed } = await generateWithFallback(prompt, 'application/json');

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch (parseErr) {
      console.error('Failed to parse Gemini JSON output:', text);
      return res.status(500).json({
        success: false,
        error: 'Lỗi định dạng khi phân tích video. Vui lòng thử lại.',
      });
    }

    const videoData = {
      id: `vid-${Date.now()}-${videoId}`,
      youtubeId: videoId,
      youtubeUrl: `https://www.youtube.com/shorts/${videoId}`,
      title: parsed.title || videoTitle || 'YouTube Short Comprehensible Input',
      channel: authorName,
      thumbnail: thumbnailUrl,
      topic: parsed.topic || 'Daily English Conversation',
      cefrLevel: parsed.cefrLevel || 'A2',
      cefrReason: parsed.cefrReason || 'Video features natural pacing and clear vocabulary for comprehensible language acquisition.',
      summary: parsed.summary || 'Real-life English spoken naturally in context.',
      duration: parsed.duration || 45,
      addedAt: new Date().toISOString(),
      inSrs: false,
      srsStage: 1,
      comprehensibilityTips: parsed.comprehensibilityTips || [
        'Listen multiple times to absorb natural cadence',
        'Focus on whole context rather than translating isolated words',
        'Shadow and mimic pronunciation rhythm immediately'
      ],
      subtitles: (parsed.subtitles || []).map((s: any, idx: number) => ({
        id: s.id || `sub-${Date.now()}-${idx}`,
        start: Number(s.start) || 0,
        end: Number(s.end) || Number(s.start || 0) + 4,
        text: s.text || '',
      })),
      suggestedVocab: (parsed.suggestedVocab || []).map((v: any, idx: number) => ({
        id: v.id || `voc-${Date.now()}-${idx}`,
        word: v.word || '',
        phonetic: v.phonetic || '',
        partOfSpeech: v.partOfSpeech || 'word',
        definitionEn: v.definitionEn || '',
        contextSentence: v.contextSentence || '',
        exampleSentence: v.exampleSentence || '',
        collocations: Array.isArray(v.collocations) ? v.collocations : [],
        timestamp: Number(v.timestamp) || 0,
        videoId: `vid-${Date.now()}-${videoId}`,
        videoTitle: parsed.title || videoTitle || 'YouTube Short',
        interval: 1,
        repetition: 0,
        easeFactor: 2.5,
        nextReviewDate: new Date().toISOString(),
        status: 'new' as const,
      })),
    };

    return res.json({
      success: true,
      video: videoData,
      modelUsed,
    });
  } catch (err: any) {
    console.error('Error in /api/analyze-video:', err);
    let errMsg = String(err?.message || err || '');
    try {
      const parsedJson = JSON.parse(errMsg);
      if (parsedJson?.error?.message) {
        errMsg = parsedJson.error.message;
      }
    } catch (_) {}

    if (errMsg.includes('503') || errMsg.includes('UNAVAILABLE') || errMsg.includes('high demand')) {
      errMsg = 'Hệ thống AI đang tạm thời quá tải lượt truy cập (503 High Demand). Vui lòng thử lại sau vài giây.';
    }

    return res.status(500).json({
      success: false,
      error: errMsg || 'Có lỗi xảy ra khi phân tích video. Vui lòng kiểm tra lại đường link.',
    });
  }
});

// Endpoint: AI instant word look up in context
app.post('/api/lookup-word', async (req, res) => {
  try {
    const { word, contextSentence } = req.body;
    if (!word) {
      return res.status(400).json({ success: false, error: 'Thiếu từ vựng cần tra cứu.' });
    }

    const prompt = `
Phân tích từ vựng "${word}" trong ngữ cảnh câu: "${contextSentence || ''}".
Mục tiêu là hỗ trợ học theo Comprehensible Input thuần túy (i+1), không dịch nghĩa tiếng Việt.
Trả về JSON:
{
  "word": "${word}",
  "phonetic": "phiên âm IPA",
  "partOfSpeech": "loại từ",
  "definitionEn": "định nghĩa tiếng Anh đơn giản dễ hiểu (Learner's English definition, không dùng tiếng Việt)",
  "exampleSentence": "câu ví dụ đời thường sinh động bằng tiếng Anh",
  "collocations": ["cụm 1", "cụm 2", "cụm 3"]
}
`;

    const { text } = await generateWithFallback(prompt, 'application/json');
    const parsed = JSON.parse(text || '{}');
    return res.json({ success: true, data: parsed });
  } catch (err: any) {
    console.error('Error in /api/lookup-word:', err);
    let errMsg = String(err?.message || err || '');
    try {
      const parsedJson = JSON.parse(errMsg);
      if (parsedJson?.error?.message) {
        errMsg = parsedJson.error.message;
      }
    } catch (_) {}

    return res.status(500).json({
      success: false,
      error: errMsg || 'Không thể tra từ lúc này.',
    });
  }
});

// Helper function to search web / Google images
async function searchWebImages(query: string) {
  const cleanQuery = query.trim();
  try {
    const tokenRes = await fetch(
      `https://duckduckgo.com/?q=${encodeURIComponent(cleanQuery)}&iar=images&iax=images&ia=images`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(4500),
      }
    );
    const html = await tokenRes.text();
    const vqdMatch = html.match(/vqd=['"]?([^&'"]+)/);

    if (vqdMatch && vqdMatch[1]) {
      const vqd = vqdMatch[1];
      const imgRes = await fetch(
        `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(cleanQuery)}&vqd=${vqd}&f=,,,`,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Referer: 'https://duckduckgo.com/',
          },
          signal: AbortSignal.timeout(4500),
        }
      );
      const data = await imgRes.json();
      if (Array.isArray(data?.results) && data.results.length > 0) {
        return data.results.slice(0, 8).map((r: any) => ({
          url: r.image,
          thumbnail: r.thumbnail || r.image,
          title: r.title || cleanQuery,
          source: r.source || 'Google & Web Image Index',
        }));
      }
    }
  } catch (e) {
    console.warn('Image search query failed or timed out:', e);
  }

  // Graceful fallback for language learning
  return [
    {
      url: `https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&auto=format&fit=crop&q=80`,
      thumbnail: `https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&auto=format&fit=crop&q=80`,
      title: cleanQuery,
      source: 'Visual Vocabulary',
    },
  ];
}

// Endpoint: Search images from Google / Web Image index
app.get('/api/image-search', async (req, res) => {
  try {
    const q = (req.query.q as string) || (req.query.word as string) || '';
    if (!q.trim()) {
      return res.status(400).json({ success: false, error: 'Thiếu từ khóa tìm kiếm ảnh.' });
    }

    const images = await searchWebImages(q);
    const googleImagesUrl = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q.trim())}`;

    return res.json({
      success: true,
      query: q.trim(),
      googleImagesUrl,
      images,
    });
  } catch (err: any) {
    console.error('Error in /api/image-search:', err);
    return res.status(500).json({
      success: false,
      error: 'Không thể tìm kiếm ảnh lúc này.',
    });
  }
});

// Vite middleware in dev or static files in prod
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Vocablink Server is running on port ${PORT}`);
  });
}

startServer();
