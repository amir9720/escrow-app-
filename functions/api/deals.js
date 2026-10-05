export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const phone = url.searchParams.get('phone');
    const shopId = url.searchParams.get('shop_id');

    if (id) {
      const deal = await env.DB.prepare('SELECT * FROM deals WHERE id = ?').bind(id).first();
      if (!deal) return new Response(JSON.stringify({ error: 'سفارش یافت نشد' }), { status: 404 });
      return new Response(JSON.stringify(deal), { headers: { 'Content-Type': 'application/json' } });
    }

    if (shopId || phone) {
      let query = 'SELECT * FROM deals WHERE 1=1';
      let params = [];
      if (shopId) {
        query += ' AND shop_id = ?';
        params.push(shopId);
      } else if (phone) {
        query += ' AND (seller_phone = ? OR buyer_phone = ?)';
        params.push(phone, phone);
      }
      query += ' ORDER BY created_at DESC';
      
      const { results } = await env.DB.prepare(query).bind(...params).all();
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
    const { shop_id, amount, buyer_phone, buyer_address, order_items } = body;

    if (!shop_id || !amount || !buyer_phone) {
      return new Response(JSON.stringify({ success: false, error: 'اطلاعات پرداخت و شماره خریدار الزامی است' }), { status: 400 });
    }

    // استعلام اطلاعات فروشنده
    const shop = await env.DB.prepare('SELECT * FROM shops WHERE id = ?').bind(shop_id).first();
    if (!shop) {
      return new Response(JSON.stringify({ success: false, error: 'فروشگاه معتبر نیست' }), { status: 404 });
    }

    const id = 'ord_' + Math.random().toString(36).substring(2, 8);
    const initialStatus = 'pending_payment';

    await env.DB.prepare(`
      INSERT INTO deals (id, shop_id, title, amount, seller_phone, seller_sheba, seller_national_id, buyer_phone, buyer_address, order_items, fee_payer, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      shop.id,
      order_items ? `سفارش از ${shop.name}: ${order_items.substring(0, 30)}` : `سفارش از ${shop.name}`,
      amount,
      shop.phone,
      shop.sheba,
      shop.national_id,
      buyer_phone,
      buyer_address || '',
      order_items || '',
      shop.fee_payer || 'buyer',
      initialStatus
    ).run();

    return new Response(JSON.stringify({ success: true, dealId: id }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
  }
}

export async function onRequestPatch({ request, env }) {
  try {
    const { id, action, tracking_code, reason, proof_url } = await request.json();
    if (!id || !action) return new Response(JSON.stringify({ success: false, error: 'پارامتر ناقص است' }), { status: 400 });

    if (action === 'ship') {
      const now = Date.now();
      await env.DB.prepare("UPDATE deals SET status = 'shipped', tracking_code = ?, shipped_at = ? WHERE id = ?")
        .bind(tracking_code || '', now, id).run();
    } else if (action === 'release') {
      await env.DB.prepare("UPDATE deals SET status = 'released' WHERE id = ?").bind(id).run();
    } else if (action === 'dispute') {
      await env.DB.prepare("UPDATE deals SET status = 'dispute', dispute_reason = ?, dispute_proof_url = ? WHERE id = ?")
        .bind(reason || 'اعلام نارضایتی بدون شرح', proof_url || '', id).run();
    }

    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
  }
}
