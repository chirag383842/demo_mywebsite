import { ArrowRight, Navigation, Star } from 'lucide-react';
import { BRAND } from '@/lib/constants';
import type { Page } from '@/components/Navbar';

type Props = {
  onNavigate: (page: Page) => void;
};

export default function Hero({ onNavigate }: Props) {
  return (
    <section className="relative min-h-[92svh] sm:min-h-[100svh] flex items-center overflow-hidden bg-charcoal-950">
      <div className="absolute inset-0">
        <img
          src="./images/kachori.webp"
          alt="Fresh Crispy Kachori served at Paras Kachoriwala"
          className="h-full w-full object-cover object-[center_32%] sm:object-right sm:object-cover scale-105 transition-transform duration-1000"
          loading="eager"
          fetchPriority="high"
          decoding="async"
        />
        {/* Balanced gradient overlays: crisp food visibility with high text readability */}
        <div className="absolute inset-0 bg-gradient-to-t sm:bg-gradient-to-r from-charcoal-950/95 via-charcoal-950/70 sm:via-charcoal-950/50 to-charcoal-950/30" />
        <div className="absolute inset-0 bg-gradient-to-b from-charcoal-950/75 via-transparent to-charcoal-950/85" />
      </div>

      <div className="relative container-max pt-24 pb-16 sm:pt-28 lg:pt-32">
        <div className="max-w-2xl">
          <div className="animate-fade-up inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-marigold-300">
            <Star size={13} className="fill-marigold-400 text-marigold-400" />
            Famous Local Food Brand
          </div>

          <h1 className="animate-fade-up mt-5 sm:mt-6 font-display text-4xl sm:text-6xl lg:text-7xl font-bold text-white leading-[1.08] text-balance" style={{ animationDelay: '0.08s' }}>
            {BRAND.name}
          </h1>

          <p className="animate-fade-up mt-2 sm:mt-3 text-sm sm:text-lg font-semibold uppercase tracking-[0.2em] text-marigold-300" style={{ animationDelay: '0.16s' }}>
            {BRAND.tagline}
          </p>

          <p className="animate-fade-up mt-4 sm:mt-6 text-base sm:text-xl text-spice-50/90 leading-relaxed max-w-xl text-balance" style={{ animationDelay: '0.24s' }}>
            Serving delicious Kachori and Bhel loved by our customers — fresh, crispy and full of authentic taste.
          </p>

          <div className="animate-fade-up mt-7 sm:mt-9 flex flex-wrap gap-3" style={{ animationDelay: '0.32s' }}>
            <button onClick={() => onNavigate('menu')} className="btn-primary group text-sm sm:text-base py-3 px-6">
              View Menu
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
            </button>
            <button
              onClick={() => onNavigate('directions')}
              className="btn bg-white/15 text-white backdrop-blur-md border border-white/30 hover:bg-white/25 active:scale-[0.98] flex items-center gap-2 text-sm sm:text-base py-3 px-5"
            >
              <Navigation size={18} />
              Get Directions
            </button>
          </div>

          <div className="animate-fade-up mt-8 sm:mt-10 flex items-center gap-4 text-spice-50/80" style={{ animationDelay: '0.4s' }}>
            <div className="flex -space-x-2">
              {[1, 2, 3].map((i) => (
                <span key={i} className="h-8 w-8 rounded-full border-2 border-charcoal-950 bg-gradient-to-br from-spice-400 to-spice-600 shadow-md" />
              ))}
            </div>
            <p className="text-xs sm:text-sm">
              <span className="font-bold text-white">Loved</span> by hundreds of foodies daily
            </p>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 inset-x-0 h-20 bg-gradient-to-t from-spice-50 to-transparent pointer-events-none" />
    </section>
  );
}
