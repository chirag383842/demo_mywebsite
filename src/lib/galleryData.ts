import type { GalleryImage } from './types';

export const DEFAULT_GALLERY_IMAGES: GalleryImage[] = [
  {
    id: 'a0000000-0000-0000-0000-000000000001',
    src: './images/kachori.webp',
    alt: 'Fresh Kachori served at Paras Kachoriwala',
    category: 'food',
    caption: 'Signature Kachori',
    display_order: 1,
    created_at: new Date('2026-08-01T12:00:00Z').toISOString(),
  },
  {
    id: 'a0000000-0000-0000-0000-000000000003',
    src: './images/lari_pic.webp',
    alt: 'Paras Kachoriwala food cart at night',
    category: 'stall',
    caption: 'Our Food Cart',
    display_order: 2,
    created_at: new Date('2026-08-03T12:00:00Z').toISOString(),
  },
  {
    id: 'a0000000-0000-0000-0000-000000000007',
    src: 'https://www.w3schools.com/html/mov_bbb.mp4',
    alt: 'Paras Kachoriwala Stall & Live Food Preparation Video',
    category: 'videos',
    media_type: 'video',
    caption: 'Live Stall Preparation & Ambience Video',
    display_order: 3,
    created_at: new Date('2026-08-07T12:00:00Z').toISOString(),
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
