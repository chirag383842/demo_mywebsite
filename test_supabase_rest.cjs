// test_supabase_rest.cjs
const supabaseUrl = 'https://nsvuwjtyevhiwkxokokt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zdnV3anR5ZXZoaXdreG9rb2t0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NzYzNzEsImV4cCI6MjEwMzE1MjM3MX0.DEur81Z4CizlmtQ2d52HTbsQMEs0Fx-ne7jnIC3s4W8';

const headers = {
  'apikey': supabaseAnonKey,
  'Authorization': `Bearer ${supabaseAnonKey}`,
  'Content-Type': 'application/json'
};

async function testRest() {
  try {
    console.log('--- 1. SELECT /rest/v1/products ---');
    const pRes = await fetch(`${supabaseUrl}/rest/v1/products?select=*`, { headers });
    const products = await pRes.json();
    console.log('Status:', pRes.status, 'Products count:', Array.isArray(products) ? products.length : products);

    console.log('\n--- 2. SELECT /rest/v1/store_status ---');
    const sRes = await fetch(`${supabaseUrl}/rest/v1/store_status?select=*`, { headers });
    const status = await sRes.json();
    console.log('Status:', sRes.status, 'Store status:', status);

    console.log('\n--- 3. TEST UPDATE on store_status ---');
    if (Array.isArray(status) && status.length > 0) {
      const uRes = await fetch(`${supabaseUrl}/rest/v1/store_status?id=eq.${status[0].id}`, {
        method: 'PATCH',
        headers: { ...headers, 'Prefer': 'return=representation' },
        body: JSON.stringify({ last_updated: new Date().toISOString() })
      });
      const uData = await uRes.text();
      console.log('Update Status:', uRes.status, 'Data:', uData);
    }

    console.log('\n--- 4. TEST INSERT on products ---');
    const testSlug = `test-item-${Date.now()}`;
    const iRes = await fetch(`${supabaseUrl}/rest/v1/products`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'return=representation' },
      body: JSON.stringify({
        slug: testSlug,
        name: 'Test Temp Item',
        price: 99,
        description: 'Testing permissions',
        image_url: '/images/kachori.webp',
        available: true,
        stock: 10,
        featured: false,
        display_order: 99
      })
    });
    const iData = await iRes.text();
    console.log('Insert Status:', iRes.status, 'Data:', iData);

    if (iRes.status === 201) {
      console.log('Cleaning up test item...');
      await fetch(`${supabaseUrl}/rest/v1/products?slug=eq.${testSlug}`, {
        method: 'DELETE',
        headers
      });
      console.log('Cleaned up!');
    }
  } catch (err) {
    console.error('Fetch error:', err.message);
  }
}

testRest();
