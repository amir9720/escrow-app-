export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const authPass = url.searchParams.get('key');
    const adminSecret = env.ADMIN_SECRET || 'admin1234';

    if (authPass !== adminSecret) {
      return new Response(JSON.stringify({ success: false, error: 'دسترسی غیرمجاز' }), { status: 401 });
    }

    const { results } = await env.DB.prepare(
      'SELECT * FROM deals ORDER BY created_at DESC LIMIT 100'
    ).all();

    return new Response(JSON.stringify({ success: true, deals: results || [] }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const { key, dealId, action, note } = body;
    const adminSecret = env.ADMIN_SECRET || 'admin1234';

    if (key !== adminSecret) {
      return new Response(JSON.stringify({ success: false, error: 'دسترسی غیرمجاز' }), { status: 401 });
    }

    if (!dealId || !action) {
      return new Response(JSON.stringify({ success: false, error: 'اطلاعات ناقص است' }), { status: 400 });
    }

    let newStatus = '';
    if (action === 'force_release') {
      newStatus = 'released'; // آزادسازی وجه به نفع فروشنده
    } else if (action === 'refund_buyer') {
      newStatus = 'refunded'; // عودت وجه به خریدار به دلیل تخلف فروشنده
    } else {
      return new Response(JSON.stringify({ success: false, error: 'دستور نامعتبر است' }), { status: 400 });
    }

    await env.DB.prepare('UPDATE deals SET status = ? WHERE id = ?')
      .bind(newStatus, dealId)
      .run();

    return new Response(JSON.stringify({
      success: true,
      message: `وضعیت معامله به ${newStatus} تغییر یافت.`,
      status: newStatus
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
  }
}
