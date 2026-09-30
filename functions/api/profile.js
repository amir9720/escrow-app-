export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const sellerId = url.searchParams.get('id') || url.searchParams.get('phone');

    if (!sellerId) {
      return new Response(JSON.stringify({ error: 'شناسه فروشنده نامعتبر است' }), { status: 400 });
    }

    // ۱. دریافت مشخصات واقعی فروشنده از جدول کاربران
    const user = await env.DB.prepare(
      'SELECT id, phone, full_name, card_number, sheba_number, is_verified, created_at FROM users WHERE id = ? OR phone = ?'
    ).bind(sellerId, sellerId).first();

    if (!user) {
      return new Response(JSON.stringify({ error: 'فروشنده‌ای با این شناسه یافت نشد' }), { status: 404 });
    }

    // ۲. شمارش تعداد معاملات موفق واقعی فروشنده (وضعیت released)
    const stats = await env.DB.prepare(
      "SELECT COUNT(*) as success_count FROM deals WHERE seller_phone = ? AND status = 'released'"
    ).bind(user.phone).first();

    return new Response(JSON.stringify({
      seller: {
        id: user.id,
        name: user.full_name,
        phone: user.phone,
        card_masked: user.card_number ? user.card_number.substring(0, 4) + '****' + user.card_number.substring(12) : '',
        sheba: user.sheba_number || '',
        is_verified: user.is_verified === 1 || !!user.national_id,
        joined_at: user.created_at,
        deals_count: stats ? stats.success_count : 0
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
