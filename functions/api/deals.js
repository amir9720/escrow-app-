export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const dealId = 'deal_' + Math.random().toString(36).substring(2, 9);

    const query = `
      INSERT INTO deals (id, title, amount, buyer_phone, seller_phone, seller_sheba, fee_payer, status, tracking_code, inspection_hours)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'held', '', 24)
    `;

    await env.DB.prepare(query)
      .bind(
        dealId,
        body.title,
        body.amount,
        body.buyer_phone,
        body.seller_phone,
        body.seller_sheba,
        body.fee_payer
      )
      .run();

    return new Response(JSON.stringify({ success: true, dealId }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const phone = url.searchParams.get('phone');
    const role = url.searchParams.get('role');

    if (id) {
      const deal = await env.DB.prepare('SELECT * FROM deals WHERE id = ?').bind(id).first();
      return new Response(JSON.stringify(deal || { error: 'Not found' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (phone && role) {
      const column = role === 'seller' ? 'seller_phone' : 'buyer_phone';
      const { results } = await env.DB.prepare(`SELECT * FROM deals WHERE ${column} = ? ORDER BY id DESC`).bind(phone).all();
      return new Response(JSON.stringify({ deals: results || [] }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Missing parameters' }), { status: 400 });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

export async function onRequestPatch({ request, env }) {
  try {
    const body = await request.json();
    const { id, action, tracking_code } = body;

    if (!id || !action) {
      return new Response(JSON.stringify({ success: false, error: 'پارامترهای ناقص' }), { status: 400 });
    }

    if (action === 'ship') {
      await env.DB.prepare("UPDATE deals SET status = 'shipped', tracking_code = ? WHERE id = ?")
        .bind(tracking_code || '', id)
        .run();
    } else if (action === 'release') {
      await env.DB.prepare("UPDATE deals SET status = 'released' WHERE id = ?")
        .bind(id)
        .run();
    } else if (action === 'dispute') {
      await env.DB.prepare("UPDATE deals SET status = 'dispute' WHERE id = ?")
        .bind(id)
        .run();
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
  }
}
