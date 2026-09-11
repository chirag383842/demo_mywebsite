import { Images, ArrowRight, RefreshCw } from 'lucide-react';
import { useGallery } from '@/lib/hooks';
import SectionHeading from '@/components/SectionHeading';
import { SectionError } from '@/components/SectionLoader';
import type { Page } from '@/components/Navbar';

type Props = { onNavigate: (page: Page) => void };

export default function GalleryPreview({ onNavigate }: Props) {
  const { data: galleryImages, loading, error, refetch } = useGallery();
  const preview = (galleryImages ?? []).slice(0, 6);

  return (
    <section className="bg-spice-100/40 section-pad">
      <div className="container-max">
        <SectionHeading
          eyebrow="Gallery"
          title="A Glimpse of the Experience"
          subtitle="Real moments — the food, the shop, and the people who make it special."
        />

        <div className="mt-10">
          {error ? (
            <SectionError
              title="Unable to load gallery preview"
              message="Photos couldn't be loaded right now. Tap Try Again or visit the full gallery page."
              onRetry={refetch}
            />
          ) : loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 animate-pulse">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className={`skeleton rounded-2xl aspect-square ${
                    i === 1 ? 'col-span-2 row-span-2' : ''
                  }`}
                />
              ))}
            </div>
          ) : preview.length === 0 ? (
            <div className="card p-8 sm:p-10 text-center max-w-md mx-auto animate-fade-up">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-spice-100 text-spice-600 flex items-center justify-center mb-3">
                <Images size={26} />
              </div>
              <p className="text-charcoal-800 font-bold text-base">Gallery Photos Coming Soon</p>
              <p className="text-charcoal-500 text-xs sm:text-sm mt-1.5 leading-relaxed">
                Moments from our stall, food preparation, and happy customers will appear here once published from the Author Panel.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
              {preview.map((img, i) => {
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
                    onClick={() => onNavigate('gallery')}
                    className="group relative aspect-square overflow-hidden rounded-2xl shadow-card bg-charcoal-900 border border-spice-200/60 hover:border-spice-400 hover:shadow-warm transition-all duration-300 animate-scale-in cursor-pointer"
                    style={{ animationDelay: `${i * 0.05}s` }}
                    aria-label={`View gallery item: ${img.caption || img.alt}`}
                  >
                    {isVideo ? (
                      <div className="relative h-full w-full bg-black flex items-center justify-center overflow-hidden">
                        <video
                          src={img.src}
                          preload="metadata"
                          muted
                          playsInline
                          className="h-full w-full object-cover opacity-85 group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                          <span className="h-9 w-9 rounded-full bg-spice-600 text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                            ▶
                          </span>
                        </div>
                      </div>
                    ) : isAudio ? (
                      <div className="h-full w-full bg-gradient-to-br from-spice-900 to-charcoal-950 flex flex-col items-center justify-center p-3 text-center">
                        <span className="text-2xl mb-1">🎵</span>
                        <span className="text-[10px] text-white font-bold truncate max-w-full">
                          {img.caption || 'Audio'}
                        </span>
                      </div>
                    ) : (
                      <img
                        src={img.src}
                        alt={img.alt}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-charcoal-950/80 via-transparent to-transparent opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" />
                    <span className="absolute bottom-2 left-2 right-2 text-left text-[11px] sm:text-xs font-semibold text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity truncate">
                      {img.caption || img.alt}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-8 flex items-center justify-center gap-3">
          <button onClick={() => onNavigate('gallery')} className="btn-outline group">
            <Images size={18} />
            View Full Gallery
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
          </button>
          {error && (
            <button
              onClick={refetch}
              type="button"
              className="btn-ghost text-xs py-2 px-3 flex items-center gap-1.5"
              aria-label="Retry gallery"
            >
              <RefreshCw size={14} />
              Retry
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
