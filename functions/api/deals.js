export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const phone = url.searchParams.get('phone');

    if (id) {
      const deal = await env.DB.prepare('SELECT * FROM deals WHERE id = ?').bind(id).first();
      if (!deal) return new Response(JSON.stringify({ error: 'معامله یافت نشد' }), { status: 404 });
      return new Response(JSON.stringify(deal), { headers: { 'Content-Type': 'application/json' } });
    }

    if (phone) {
      const { results } = await env.DB.prepare(
        'SELECT * FROM deals WHERE seller_phone = ? OR buyer_phone = ? ORDER BY created_at DESC'
      ).bind(phone, phone).all();
      return new Response(JSON.stringify(results || []), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'پارامتر نامعتبر است' }), { status: 400 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const { title, amount, buyer_phone, seller_phone, seller_sheba, fee_payer } = body;

    if (!title || !amount || !buyer_phone || !seller_phone || !seller_sheba) {
      return new Response(JSON.stringify({ success: false, error: 'تمامی فیلدها الزامی است' }), { status: 400 });
    }

    const id = 'deal_' + Math.random().toString(36).substring(2, 8);
    // وضعیت قطعی در بدو ایجاد: حتماً در انتظار پرداخت است
    const initialStatus = 'pending_payment';

    await env.DB.prepare(`
      INSERT INTO deals (id, title, amount, buyer_phone, seller_phone, seller_sheba, fee_payer, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, title, amount, buyer_phone, seller_phone, seller_sheba, fee_payer || 'buyer', initialStatus).run();

    return new Response(JSON.stringify({ success: true, dealId: id }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
  }
}

export async function onRequestPatch({ request, env }) {
  try {
    const { id, action, tracking_code, reason } = await request.json();
    if (!id || !action) return new Response(JSON.stringify({ success: false, error: 'پارامتر ناقص است' }), { status: 400 });

    if (action === 'ship') {
      await env.DB.prepare("UPDATE deals SET status = 'shipped', tracking_code = ? WHERE id = ?")
        .bind(tracking_code || '', id).run();
    } else if (action === 'release') {
      await env.DB.prepare("UPDATE deals SET status = 'released' WHERE id = ?").bind(id).run();
    } else if (action === 'dispute') {
      await env.DB.prepare("UPDATE deals SET status = 'dispute' WHERE id = ?").bind(id).run();
    }

    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
  }
}
