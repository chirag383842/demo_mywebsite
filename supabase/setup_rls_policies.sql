-- =========================================================================
-- PARAS KACHORIWALA: REAL-TIME CLIENT ACCESS & RLS POLICIES
-- Run this script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/nsvuwjtyevhiwkxokokt/sql
-- =========================================================================

-- 1. Enable Row Level Security
ALTER TABLE IF EXISTS products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS store_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS gallery ENABLE ROW LEVEL SECURITY;

-- Store status overrides used by the Author portal
ALTER TABLE IF EXISTS store_status ADD COLUMN IF NOT EXISTS closed_for_date text;
ALTER TABLE IF EXISTS store_status ADD COLUMN IF NOT EXISTS force_open_date text;

-- 2. Clean up existing conflicting policies
DROP POLICY IF EXISTS "allow_all_products" ON products;
DROP POLICY IF EXISTS "public_read_products" ON products;
DROP POLICY IF EXISTS "public_update_products" ON products;
DROP POLICY IF EXISTS "public_insert_products" ON products;

DROP POLICY IF EXISTS "allow_all_store_status" ON store_status;
DROP POLICY IF EXISTS "public_read_store_status" ON store_status;
DROP POLICY IF EXISTS "public_update_store_status" ON store_status;
DROP POLICY IF EXISTS "public_insert_store_status" ON store_status;

DROP POLICY IF EXISTS "allow_all_feedback" ON feedback;
DROP POLICY IF EXISTS "client_read_all_feedback" ON feedback;
DROP POLICY IF EXISTS "client_update_feedback" ON feedback;
DROP POLICY IF EXISTS "client_delete_feedback" ON feedback;
DROP POLICY IF EXISTS "public_delete_feedback" ON feedback;

DROP POLICY IF EXISTS "allow_all_gallery" ON gallery;
DROP POLICY IF EXISTS "public_read_gallery" ON gallery;
DROP POLICY IF EXISTS "public_insert_gallery" ON gallery;
DROP POLICY IF EXISTS "public_update_gallery" ON gallery;
DROP POLICY IF EXISTS "public_delete_gallery" ON gallery;

-- 3. PRODUCTS: Full read & write for website and author portal
CREATE POLICY "allow_all_products" ON products
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 4. STORE STATUS: Full read & write for live open/close & crowd levels
CREATE POLICY "allow_all_store_status" ON store_status
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 5. FEEDBACK / REVIEWS: Allow customers to insert, all users to view, and author to manage
CREATE POLICY "allow_all_feedback" ON feedback
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 6. GALLERY: Full read & write for author photo uploads and customer views
CREATE POLICY "allow_all_gallery" ON gallery
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 7. Ensure publication includes tables for real-time WebSockets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'store_status'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE store_status;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'products'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE products;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'feedback'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE feedback;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'gallery'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE gallery;
  END IF;
END $$;

-- 8. Seed all 4 menu varieties into products table
INSERT INTO products (slug, name, price, description, image_url, available, stock, featured, display_order)
VALUES
  ('kachori', 'Regular Kachori', 40, 'Crispy, golden-fried puffed pastry stuffed with our classic spiced lentil and onion filling — served fresh with tangy house chutneys.', '/images/kachori.webp', true, 80, true, 1),
  ('kachori-jain', 'Jain Kachori (No Onion / No Garlic)', 40, 'Prepared strictly per Jain dietary traditions without onion or garlic — packed with rich authentic spices and served with fresh sweet and spicy chutneys.', '', true, 50, false, 2),
  ('kachori-swaminarayan', 'Swaminarayan Kachori (Satvik)', 40, 'Pure satvik preparation crafted strictly without onion or garlic, following Swaminarayan dietary guidelines with fragrant spices and fresh chutneys.', '', true, 50, false, 3),
  ('bhel', 'Fresh Bhel', 40, 'Light, crunchy puffed rice tossed with fresh tomatoes, onions, sev and our house chutneys — a burst of flavour in every bite.', '/images/bhel.webp', true, 60, false, 4)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  image_url = CASE WHEN products.image_url IS NULL OR products.image_url = '' THEN EXCLUDED.image_url ELSE products.image_url END;


