import type { GalleryImage } from './types';

export const DEFAULT_GALLERY_IMAGES: GalleryImage[] = [
  {
    id: 'f1a2b3c4-0001-4000-8000-000000000001',
    src: '/images/lari_pic.webp',
    alt: 'Paras Kachoriwala Evening Food Cart & Stall Setup',
    category: 'stall',
    media_type: 'image',
    caption: 'Our Stall Setup at Night',
    display_order: 1,
    created_at: '2025-01-01T12:00:00.000Z',
  },
  {
    id: 'f1a2b3c4-0002-4000-8000-000000000002',
    src: '/images/kachori.webp',
    alt: 'Crispy Fresh Kachori with Special Chutneys',
    category: 'food',
    media_type: 'image',
    caption: 'Crispy Golden Kachori Served Fresh',
    display_order: 2,
    created_at: '2025-01-01T12:05:00.000Z',
  },
  {
    id: 'f1a2b3c4-0003-4000-8000-000000000003',
    src: '/images/bhel.webp',
    alt: 'Fresh Crunchy Bhel with Sev and Chutneys',
    category: 'food',
    media_type: 'image',
    caption: 'Crunchy Street Bhel Prepared On Order',
    display_order: 3,
    created_at: '2025-01-01T12:10:00.000Z',
  },
];

export const GALLERY_CATEGORIES: {
  id: GalleryImage['category'] | 'all';
  label: string;
  shortLabel: string;
  icon: string;
  description: string;
}[] = [
  { id: 'all', label: 'All Photos & Media', shortLabel: 'All', icon: '🖼️', description: 'All gallery photos & videos' },
  { id: 'customers', label: 'Customers / Foodies', shortLabel: 'Customers', icon: '👥', description: 'Happy customers, foodies & community moments' },
  { id: 'stall', label: 'Stall / Cart Location', shortLabel: 'Stall / Cart', icon: '🛒', description: 'Food cart, night stall, and location setup' },
  { id: 'food', label: 'Food / Menu Section', shortLabel: 'Food / Menu', icon: '🍽️', description: 'Crispy Kachori, Bhel, chutneys & ingredients' },
  { id: 'videos', label: 'Videos & Clips (MP4/MP3)', shortLabel: 'Videos', icon: '🎬', description: 'Videos and media clips from our stall' },
];
