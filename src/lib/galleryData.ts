import type { GalleryImage } from './types';

export const DEFAULT_GALLERY_IMAGES: GalleryImage[] = [];

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
