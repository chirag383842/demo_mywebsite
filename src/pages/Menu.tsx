import { CheckCircle2, XCircle, IndianRupee, Leaf, Banknote, Ticket, Sparkles } from 'lucide-react';
import { useProducts, useStoreStatus } from '@/lib/hooks';
import StatusBadge from '@/components/StatusBadge';
import { SectionSkeleton, SectionError } from '@/components/SectionLoader';
import type { Product } from '@/lib/types';

export default function Menu() {
  const { data: products, loading, error, refetch } = useProducts();
  const { computed } = useStoreStatus();
  const open = computed.isOpen;

  return (
    <div className="pt-20 sm:pt-24">
      <section className="container-max section-pad">
        <div className="text-center max-w-2xl mx-auto">
          <div className="eyebrow justify-center mb-3">
            <span className="h-px w-8 bg-spice-400" /> Our Menu <span className="h-px w-8 bg-spice-400" />
          </div>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-charcoal-900 text-balance">
            Fresh Kachori & Signature Bhel
          </h1>
          <p className="mt-4 text-lg text-charcoal-600 text-balance">
            Available in Regular, Jain (No Onion/Garlic) & Swaminarayan (Satvik) preparations.
          </p>
          <div className="mt-6 flex justify-center">
            <StatusBadge open={open} size="md" />
          </div>
        </div>

        <div className="mt-10 max-w-3xl mx-auto rounded-2xl bg-gradient-to-r from-amber-500/15 via-spice-500/15 to-amber-500/10 border-2 border-spice-300 p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-spice-600 text-white shadow-md">
                <Banknote size={24} />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wider font-bold text-spice-800 bg-spice-100 px-2 py-0.5 rounded-md">
                    Important Store Notice
                  </span>
                </div>
                <p className="font-display text-lg font-bold text-charcoal-900 mt-1">
                  💵 Cash Payment Only • 🎫 Token System at Counter
                </p>
                <p className="text-xs text-charcoal-600 mt-0.5">
                  <strong>No online / UPI payments accepted.</strong> Please pay cash and collect your token at the counter for a freshly prepared serving. In-store visit only (No online delivery).
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-charcoal-800 bg-white px-3.5 py-2 rounded-xl border border-spice-200 shadow-sm shrink-0 self-center sm:self-auto">
              <Ticket size={16} className="text-spice-600" />
              Token at Counter
            </span>
          </div>
        </div>

        <div className="mt-12">
          {loading ? (
            <SectionSkeleton count={2} variant="cards" />
          ) : error ? (
            <div className="max-w-3xl mx-auto">
              <SectionError
                title="Unable to load menu"
                message="Live menu prices could not be loaded. Showing default menu. Tap Retry for live prices."
                onRetry={refetch}
              />
              <div className="mt-8 grid gap-8 lg:gap-10 sm:grid-cols-2 max-w-5xl mx-auto">
                {(products ?? []).map((p, i) => (
                  <MenuCard key={p.id} product={p} index={i} />
                ))}
              </div>
            </div>
          ) : (
            <div className="grid gap-8 lg:gap-10 sm:grid-cols-2 max-w-5xl mx-auto">
              {(products ?? []).map((p, i) => (
                <MenuCard key={p.id} product={p} index={i} />
              ))}
            </div>
          )}
        </div>

        <div className="mt-14 card p-6 max-w-2xl mx-auto bg-spice-50/60 border border-spice-200 text-center space-y-2">
          <p className="text-sm font-bold text-charcoal-900 flex items-center justify-center gap-2">
            <Banknote size={18} className="text-spice-600" />
            Cash Payment Only • Token System at Counter
          </p>
          <p className="text-xs text-charcoal-600 leading-relaxed">
            We do not accept online payments or online delivery orders. Please visit our stall in person to enjoy freshly made food.
          </p>
        </div>
      </section>
    </div>
  );
}

function MenuCard({ product: p, index }: { product: Product; index: number }) {
  const isJain = p.slug.includes('jain') || p.name.toLowerCase().includes('jain');
  const isSwaminarayan = p.slug.includes('swaminarayan') || p.name.toLowerCase().includes('swaminarayan');
  const isSpecial = p.slug.includes('special') || p.name.toLowerCase().includes('special');
  return (
    <article
      className="card group overflow-hidden flex flex-col justify-between animate-fade-up hover:shadow-warm transition-all duration-300"
      style={{ animationDelay: `${index * 0.08}s` }}
    >
      <div>
        <div className="relative aspect-[4/3] overflow-hidden bg-charcoal-950">
          {p.image_url ? (
            <>
              <img
                src={p.image_url}
                alt={p.name}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-charcoal-950/40 to-transparent" />
              {p.featured && (
                <span className="absolute top-4 left-4 rounded-full bg-marigold-400 text-charcoal-900 text-xs font-bold uppercase tracking-wider px-3 py-1 shadow-lg">
                  Signature Item
                </span>
              )}
            </>
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-spice-900 via-charcoal-900 to-charcoal-950 p-6 flex flex-col items-center justify-center text-center">
              <div className="h-16 w-16 rounded-2xl bg-white/10 border border-white/20 grid place-items-center mb-3">
                {isJain || isSwaminarayan ? (
                  <Leaf size={32} className="text-leaf-400" />
                ) : (
                  <Sparkles size={32} className="text-marigold-400" />
                )}
              </div>
              <p className="font-display text-xl font-bold text-white">{p.name}</p>
              <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-marigold-300 bg-white/10 px-3 py-1 rounded-full border border-white/15">
                📸 Photo Coming Soon
              </span>
            </div>
          )}

          <div className="absolute top-4 right-4">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold shadow-md ${
                p.available ? 'bg-leaf-500 text-white' : 'bg-red-500 text-white'
              }`}
            >
              {p.available ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
              {p.available ? 'Available' : 'Sold Out'}
            </span>
          </div>
        </div>

        <div className="p-6 sm:p-7">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-display text-2xl font-bold text-charcoal-900">{p.name}</h2>
                {isJain && (
                  <span className="text-[11px] font-bold bg-leaf-100 text-leaf-800 border border-leaf-300 px-2.5 py-0.5 rounded-full">
                    🌿 100% Jain
                  </span>
                )}
                {isSwaminarayan && (
                  <span className="text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-0.5 rounded-full">
                    ✨ Satvik
                  </span>
                )}
                {isSpecial && !p.featured && (
                  <span className="text-[11px] font-bold bg-spice-100 text-spice-800 border border-spice-300 px-2.5 py-0.5 rounded-full">
                    ⭐ Special
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-baseline shrink-0">
              <IndianRupee size={18} className="text-spice-600" strokeWidth={2.5} />
              <span className="font-display text-2xl font-bold text-spice-700">{p.price}</span>
            </div>
          </div>

          <p className="mt-3 text-sm text-charcoal-600 leading-relaxed">{p.description}</p>
        </div>
      </div>

      <div className="px-6 pb-6 pt-0">
        {!p.available && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 text-red-700 px-3 py-1 text-xs font-semibold">
            <XCircle size={13} /> Currently Sold Out
          </span>
        )}
      </div>
    </article>
  );
}
