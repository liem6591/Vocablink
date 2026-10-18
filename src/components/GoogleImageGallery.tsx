import React, { useState, useEffect } from 'react';
import {
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Loader2,
  Image as ImageIcon,
  Check,
  RefreshCw,
  Search
} from 'lucide-react';

interface ImageItem {
  url: string;
  thumbnail: string;
  title: string;
  source: string;
}

interface GoogleImageGalleryProps {
  query: string;
  variant?: 'card' | 'compact' | 'thumbnail';
  className?: string;
  onSelectImage?: (url: string) => void;
  selectedImageUrl?: string;
}

// In-memory cache to avoid redundant API calls
const imageCache = new Map<string, { images: ImageItem[]; googleImagesUrl: string }>();

export const GoogleImageGallery: React.FC<GoogleImageGalleryProps> = ({
  query,
  variant = 'card',
  className = '',
  onSelectImage,
  selectedImageUrl,
}) => {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [googleImagesUrl, setGoogleImagesUrl] = useState<string>('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const cleanQuery = (query || '').trim();

  useEffect(() => {
    if (!cleanQuery) return;

    if (imageCache.has(cleanQuery)) {
      const cached = imageCache.get(cleanQuery)!;
      setImages(cached.images);
      setGoogleImagesUrl(cached.googleImagesUrl);
      setCurrentIndex(0);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setLoadError(false);

    fetch(`/api/image-search?q=${encodeURIComponent(cleanQuery)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.success && Array.isArray(data.images) && data.images.length > 0) {
          setImages(data.images);
          setGoogleImagesUrl(data.googleImagesUrl || `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(cleanQuery)}`);
          imageCache.set(cleanQuery, {
            images: data.images,
            googleImagesUrl: data.googleImagesUrl,
          });
          setCurrentIndex(0);
        } else {
          setLoadError(true);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('Failed to load Google images:', err);
        setLoadError(true);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [cleanQuery]);

  const activeImage = selectedImageUrl
    ? { url: selectedImageUrl, thumbnail: selectedImageUrl, title: cleanQuery, source: 'Saved Image' }
    : images[currentIndex] || null;

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (images.length > 0) {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (images.length > 0) {
      setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    }
  };

  const directGoogleSearchUrl = googleImagesUrl || `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(cleanQuery)}`;

  // VARIANT: Thumbnail (For table/list rows)
  if (variant === 'thumbnail') {
    if (loading) {
      return (
        <div className="w-10 h-10 rounded-lg bg-slate-800 animate-pulse flex items-center justify-center">
          <Loader2 className="w-3.5 h-3.5 text-slate-500 animate-spin" />
        </div>
      );
    }
    if (!activeImage) {
      return null;
    }
    return (
      <a
        href={directGoogleSearchUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="relative w-10 h-10 rounded-lg overflow-hidden border border-slate-800 shrink-0 group block"
        title={`Xem ảnh Google Images cho "${cleanQuery}"`}
      >
        <img
          src={activeImage.thumbnail || activeImage.url}
          alt={cleanQuery}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform"
        />
        <div className="absolute inset-0 bg-slate-950/20 group-hover:bg-transparent" />
      </a>
    );
  }

  // VARIANT: Compact
  if (variant === 'compact') {
    return (
      <div className={`rounded-xl border border-slate-800 bg-slate-950/80 p-3 space-y-2 ${className}`}>
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-amber-400 flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Ảnh Google Images</span>
          </span>
          <a
            href={directGoogleSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
          >
            <span>Google Images</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {loading ? (
          <div className="aspect-video w-full rounded-lg bg-slate-900 animate-pulse flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
          </div>
        ) : activeImage ? (
          <div className="relative aspect-video w-full rounded-lg overflow-hidden border border-slate-800">
            <img
              src={activeImage.url}
              alt={activeImage.title || cleanQuery}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="p-3 text-center text-xs text-slate-500">
            Không tìm thấy ảnh.
          </div>
        )}
      </div>
    );
  }

  // VARIANT: Card (Full rich presentation on Flashcards)
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-md group ${className}`}
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900/90 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-1.5 font-semibold text-amber-300">
          {/* Google colors dot */}
          <span className="flex items-center gap-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          </span>
          <span className="font-mono text-[11px] tracking-wide uppercase">Google Images</span>
          {images.length > 1 && (
            <span className="text-[10px] text-slate-400 font-mono">
              ({currentIndex + 1}/{images.length})
            </span>
          )}
        </div>

        <a
          href={directGoogleSearchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
          title="Mở toàn bộ kết quả trên Google Images"
        >
          <span>Tìm kiếm trên Google</span>
          <ExternalLink className="w-3 h-3 text-slate-400" />
        </a>
      </div>

      {/* Main Image Frame */}
      <div className="relative aspect-video w-full overflow-hidden bg-slate-950 flex items-center justify-center">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
            <span className="text-xs font-mono">Đang lấy ảnh từ Google...</span>
          </div>
        ) : activeImage ? (
          <>
            <img
              src={activeImage.url}
              alt={activeImage.title || cleanQuery}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-102"
              onError={(e) => {
                // Try fallback to thumbnail or next image
                if (activeImage.thumbnail && (e.currentTarget.src !== activeImage.thumbnail)) {
                  e.currentTarget.src = activeImage.thumbnail;
                }
              }}
            />

            {/* Subtle bottom shadow overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent pointer-events-none" />

            {/* Bottom query label */}
            <div className="absolute bottom-2.5 left-2.5 right-12 truncate text-[11px] text-white font-medium drop-shadow px-2 py-0.5 rounded bg-slate-950/70 backdrop-blur-sm border border-slate-800/80 w-fit max-w-[80%]">
              {activeImage.title || cleanQuery}
            </div>

            {/* Next/Prev Buttons if multiple images */}
            {images.length > 1 && (
              <div className="absolute inset-y-0 inset-x-1 flex items-center justify-between pointer-events-none">
                <button
                  onClick={handlePrev}
                  className="pointer-events-auto p-1.5 rounded-full bg-slate-950/80 hover:bg-slate-900 text-white border border-slate-700 backdrop-blur-sm transition-all cursor-pointer shadow active:scale-95"
                  title="Ảnh trước"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleNext}
                  className="pointer-events-auto p-1.5 rounded-full bg-slate-950/80 hover:bg-slate-900 text-white border border-slate-700 backdrop-blur-sm transition-all cursor-pointer shadow active:scale-95"
                  title="Ảnh tiếp theo"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="p-6 text-center text-xs text-slate-500 space-y-2">
            <ImageIcon className="w-8 h-8 text-slate-600 mx-auto" />
            <p>Không tìm thấy ảnh tự động cho "{cleanQuery}".</p>
            <a
              href={directGoogleSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-700 text-xs font-semibold"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Tìm trên Google Images</span>
            </a>
          </div>
        )}
      </div>

      {/* Thumbnails strip for multi-image selection */}
      {images.length > 1 && (
        <div className="p-2 bg-slate-950 border-t border-slate-900 flex items-center gap-1.5 overflow-x-auto">
          {images.slice(0, 6).map((img, idx) => (
            <button
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex(idx);
                onSelectImage?.(img.url);
              }}
              className={`relative w-12 h-9 rounded-md overflow-hidden border shrink-0 transition-all cursor-pointer ${
                currentIndex === idx
                  ? 'border-amber-400 ring-2 ring-amber-400/40'
                  : 'border-slate-800 opacity-60 hover:opacity-100'
              }`}
            >
              <img src={img.thumbnail || img.url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
