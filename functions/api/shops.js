export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const phone = url.searchParams.get('phone');

    if (id) {
      const shop = await env.DB.prepare('SELECT id, name, phone, fee_payer FROM shops WHERE id = ?').bind(id).first();
      if (!shop) return new Response(JSON.stringify({ error: 'فروشگاه یافت نشد' }), { status: 404 });
      return new Response(JSON.stringify(shop), { headers: { 'Content-Type': 'application/json' } });
    }

    if (phone) {
      const shop = await env.DB.prepare('SELECT * FROM shops WHERE phone = ?').bind(phone).first();
      return new Response(JSON.stringify(shop || null), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'پارامتر نامعتبر است' }), { status: 400 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const { name, phone, national_id, sheba, fee_payer } = await request.json();

    if (!name || !phone || !national_id || !sheba) {
      return new Response(JSON.stringify({ success: false, error: 'تمامی فیلدها الزامی است' }), { status: 400 });
    }

    // تولید شناسه اختصاصی فروشگاه (مثل shop_xxxx)
    const id = 'shop_' + Math.random().toString(36).substring(2, 7);

    await env.DB.prepare(`
      INSERT INTO shops (id, name, phone, national_id, sheba, fee_payer)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(phone) DO UPDATE SET
        name = excluded.name,
        national_id = excluded.national_id,
        sheba = excluded.sheba,
        fee_payer = excluded.fee_payer
    `).bind(id, name, phone, national_id, sheba, fee_payer || 'buyer').run();

    // بازیابی شناسه نهایی فروشگاه
    const current = await env.DB.prepare('SELECT id FROM shops WHERE phone = ?').bind(phone).first();

    return new Response(JSON.stringify({ success: true, shopId: current.id }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
  }
}
