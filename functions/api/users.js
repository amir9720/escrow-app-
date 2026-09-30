export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const userId = 'usr_' + Math.random().toString(36).substring(2, 9);

    await env.DB.prepare(`
      INSERT INTO users (id, phone, full_name, national_id, card_number, sheba_number, role, is_verified)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      ON CONFLICT(phone) DO UPDATE SET
        full_name = excluded.full_name,
        national_id = excluded.national_id,
        card_number = excluded.card_number,
        is_verified = 1
    `).bind(
      userId,
      body.phone,
      body.name,
      body.national_id || '',
      body.card_number || '',
      body.sheba_number || '',
      body.role
    ).run();

    return new Response(JSON.stringify({ success: true, userId, phone: body.phone }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
  }
}
