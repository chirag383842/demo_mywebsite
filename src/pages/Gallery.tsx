import { useState, useMemo } from 'react';
import { useGallery } from '@/lib/hooks';
import { GALLERY_CATEGORIES } from '@/lib/galleryData';
import Lightbox from '@/components/Lightbox';
import type { GalleryImage, GalleryCategory } from '@/lib/types';
import { Sparkles, Users, Utensils, Store, Video, Layers, RefreshCw, Play, Music } from 'lucide-react';
import { SectionSkeleton, SectionError } from '@/components/SectionLoader';

export default function Gallery() {
  const { data: galleryImages, loading, error, refetch } = useGallery();
  const [active, setActive] = useState<GalleryCategory>('all');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [failedMediaIds, setFailedMediaIds] = useState<Set<string>>(new Set());

  const images = useMemo(() => {
    const raw = galleryImages ?? [];
    return raw.filter(
      (img) =>
        img &&
        img.src &&
        typeof img.src === 'string' &&
        img.src.trim() !== '' &&
        !failedMediaIds.has(img.id)
    );
  }, [galleryImages, failedMediaIds]);

  const filtered = useMemo(() => {
    if (active === 'all') return images;
    if (active === 'videos') {
      return images.filter(
        (g) =>
          g.category === 'videos' ||
          g.media_type === 'video' ||
          g.media_type === 'audio' ||
          g.src.toLowerCase().endsWith('.mp4') ||
          g.src.toLowerCase().endsWith('.webm') ||
          g.src.toLowerCase().endsWith('.mp3') ||
          g.src.toLowerCase().endsWith('.wav') ||
          g.src.startsWith('data:video/') ||
          g.src.startsWith('data:audio/')
      );
    }
    return images.filter((g) => g.category === active);
  }, [active, images]);

  const openLightbox = (img: GalleryImage) => {
    const idx = filtered.findIndex((g) => g.id === img.id);
    if (idx >= 0) setLightboxIndex(idx);
  };

  const getCategoryIcon = (catId: string) => {
    switch (catId) {
      case 'food':
        return <Utensils size={15} />;
      case 'stall':
      case 'shop':
        return <Store size={15} />;
      case 'customers':
        return <Users size={15} />;
      case 'videos':
        return <Video size={15} />;
      default:
        return <Layers size={15} />;
    }
  };

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'customers':
        return '👥 Customers';
      case 'stall':
      case 'shop':
        return '🛒 Stall';
      case 'food':
        return '🍽️ Food';
      case 'videos':
        return '🎬 Video';
      default:
        return cat;
    }
  };

  return (
    <div className="pt-20 sm:pt-24">
      <section className="container-max section-pad">
        <div className="text-center max-w-2xl mx-auto">
          <div className="eyebrow justify-center mb-3">
            <span className="h-px w-8 bg-spice-400" /> Photo & Video Gallery <span className="h-px w-8 bg-spice-400" />
          </div>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-charcoal-900 text-balance">
            Moments at Paras Kachoriwala
          </h1>
          <p className="mt-4 text-lg text-charcoal-600 text-balance">
            Browse real photographs, stall setup, happy customer moments, and video clips.
          </p>
          {error && (
            <button
              onClick={refetch}
              type="button"
              className="mt-5 inline-flex items-center gap-1.5 btn-outline text-xs py-2 px-4"
            >
              <RefreshCw size={14} />
              Reload Gallery
            </button>
          )}
        </div>

        {/* 4 Category Folder Tabs */}
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {GALLERY_CATEGORIES.map((c) => {
            const count =
              c.id === 'all'
                ? images.length
                : c.id === 'videos'
                ? images.filter(
                    (g) =>
                      g.category === 'videos' ||
                      g.media_type === 'video' ||
                      g.media_type === 'audio' ||
                      g.src.toLowerCase().endsWith('.mp4') ||
                      g.src.toLowerCase().endsWith('.webm') ||
                      g.src.toLowerCase().endsWith('.mp3') ||
                      g.src.toLowerCase().endsWith('.wav') ||
                      g.src.startsWith('data:video/') ||
                      g.src.startsWith('data:audio/')
                  ).length
                : images.filter((g) => g.category === c.id).length;
            const isSelected = active === c.id;

            return (
              <button
                key={c.id}
                onClick={() => setActive(c.id as GalleryCategory)}
                className={`rounded-full px-4 py-2 text-sm font-semibold flex items-center gap-2 transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? 'bg-spice-600 text-white shadow-warm font-bold ring-2 ring-spice-500/20'
                    : 'bg-white text-charcoal-700 border border-spice-200 hover:border-spice-400 hover:text-spice-700'
                }`}
              >
                {getCategoryIcon(c.id)}
                <span>{c.shortLabel || c.label}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-spice-100 text-spice-800'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <SectionSkeleton count={6} variant="gallery" />
        ) : error ? (
          <div className="mt-10">
            <SectionError
              title="Unable to load gallery"
              message="The gallery couldn't be loaded right now. You can try again, and we'll keep checking in the background."
              onRetry={refetch}
            />
          </div>
        ) : filtered.length > 0 ? (
          <div className="mt-8 sm:mt-10 grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
            {filtered.map((img, i) => {
              const isVideo =
                img.media_type === 'video' ||
                img.src.toLowerCase().endsWith('.mp4') ||
                img.src.toLowerCase().endsWith('.webm') ||
                img.src.startsWith('data:video/');
              const isAudio =
                img.media_type === 'audio' ||
                img.src.toLowerCase().endsWith('.mp3') ||
                img.src.toLowerCase().endsWith('.wav') ||
                img.src.startsWith('data:audio/');

              return (
                <button
                  key={img.id}
                  onClick={() => openLightbox(img)}
                  className="group relative block w-full overflow-hidden rounded-2xl shadow-card bg-charcoal-900 border border-spice-200/60 hover:border-spice-400 hover:shadow-warm transition-all duration-300 animate-scale-in focus:outline-none focus-visible:ring-2 focus-visible:ring-spice-500 cursor-pointer text-left"
                  style={{ animationDelay: `${i * 0.04}s` }}
                  aria-label={`Open media: ${img.caption || img.alt}`}
                >
                  {isVideo ? (
                    <div className="relative aspect-[4/3] w-full bg-black flex items-center justify-center overflow-hidden">
                      <video
                        src={img.src}
                        preload="metadata"
                        muted
                        playsInline
                        onError={() => setFailedMediaIds((prev) => new Set(prev).add(img.id))}
                        className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-700"
                      />
                      <div className="absolute inset-0 bg-charcoal-950/30 group-hover:bg-charcoal-950/10 transition-colors flex items-center justify-center">
                        <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-full bg-spice-600/90 text-white shadow-xl flex items-center justify-center transform group-hover:scale-110 transition-transform">
                          <Play size={20} fill="white" className="ml-0.5" />
                        </div>
                      </div>
                      <span className="absolute top-2 right-2 rounded-full bg-charcoal-950/80 backdrop-blur-sm text-marigold-300 text-[10px] font-bold px-2 py-0.5 border border-white/20 flex items-center gap-1">
                        <Video size={11} /> Video
                      </span>
                    </div>
                  ) : isAudio ? (
                    <div className="aspect-[4/3] w-full bg-gradient-to-br from-spice-900 to-charcoal-950 flex flex-col items-center justify-center p-4 sm:p-6 text-center">
                      <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-spice-600/30 border border-spice-400/30 text-spice-300 grid place-items-center mb-2 sm:mb-3">
                        <Music size={24} className="sm:w-7 sm:h-7" />
                      </div>
                      <p className="font-display text-xs sm:text-sm font-bold text-white truncate max-w-full">
                        {img.caption || 'Audio Recording'}
                      </p>
                      <span className="mt-1.5 text-[9px] sm:text-[10px] uppercase font-bold text-spice-300 bg-white/10 px-2 py-0.5 rounded-full border border-white/10">
                        🎵 Audio Clip
                      </span>
                    </div>
                  ) : (
                    <div className="relative overflow-hidden aspect-[4/3] bg-charcoal-900">
                      <img
                        src={img.src}
                        alt={img.alt}
                        loading="lazy"
                        decoding="async"
                        onError={() => setFailedMediaIds((prev) => new Set(prev).add(img.id))}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-charcoal-950/90 via-charcoal-950/30 to-transparent opacity-85 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" />
                  <div className="absolute bottom-2 left-2 right-2 sm:bottom-3 sm:left-3 sm:right-3 text-left opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <span className="text-[9px] sm:text-[11px] font-bold text-marigold-300 uppercase tracking-wider block">
                      {getCategoryLabel(img.category)}
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-white block mt-0.5 truncate">
                      {img.caption || img.alt}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mt-12 card p-8 sm:p-12 text-center max-w-md mx-auto animate-fade-up">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-spice-100 text-spice-600 flex items-center justify-center mb-4">
              <Sparkles size={28} />
            </div>
            <h3 className="text-charcoal-900 font-display text-xl font-bold">
              {active === 'all'
                ? 'Gallery is Ready for New Photos'
                : `No Items in ${GALLERY_CATEGORIES.find((c) => c.id === active)?.label || 'this Folder'}`}
            </h3>
            <p className="text-charcoal-600 text-sm mt-2 leading-relaxed">
              {active === 'all'
                ? 'No photos or videos uploaded yet. Upload new moments from the Author Panel to showcase them here!'
                : 'You can upload photos or videos to this folder from the Author Panel.'}
            </p>
            {active !== 'all' && (
              <button
                type="button"
                onClick={() => setActive('all')}
                className="mt-5 inline-flex items-center gap-1.5 btn-primary text-xs py-2 px-4 shadow-sm cursor-pointer"
              >
                View All Media
              </button>
            )}
          </div>
        )}
      </section>

      {lightboxIndex !== null && filtered[lightboxIndex] && (
        <Lightbox
          images={filtered}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </div>
  );
}
