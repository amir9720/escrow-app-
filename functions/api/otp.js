export async function onRequestPost({ request, env }) {
  try {
    const { phone } = await request.json();

    if (!phone || !/^09\d{9}$/.test(phone)) {
      return new Response(JSON.stringify({ success: false, error: 'شماره موبایل معتبر نیست' }), { status: 400 });
    }

    // تولید کد تصادفی ۴ رقمی
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = Date.now() + (2 * 60 * 1000); // انقضا: ۲ دقیقه بعد

    // ذخیره در جدول otp_codes دیتابیس D1
    await env.DB.prepare(`
      INSERT INTO otp_codes (phone, code, expires_at)
      VALUES (?, ?, ?)
      ON CONFLICT(phone) DO UPDATE SET
        code = excluded.code,
        expires_at = excluded.expires_at
    `).bind(phone, code, expiresAt).run();

    // اگر کلید کاوه‌نگار در متغیرهای کلودفلر ست شده باشد پیامک واقعی ارسال می‌شود:
    // (env.KAVENEGAR_API_KEY)
    if (env.KAVENEGAR_API_KEY) {
      try {
        const kavenegarUrl = `https://api.kavenegar.com/v1/${env.KAVENEGAR_API_KEY}/verify/lookup.json?receptor=${phone}&token=${code}&template=verify`;
        await fetch(kavenegarUrl);
      } catch (err) {
        console.error('SMS Send Error:', err);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'کد تایید ارسال شد',
      // در صورت نبود پنل پیامکی، برای راحتی تست کد در خروجی کنسول مرورگر نمایش داده می‌شود:
      debug_code: env.KAVENEGAR_API_KEY ? undefined : code
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
  }
}

export async function onRequestPut({ request, env }) {
  try {
    const { phone, code } = await request.json();

    if (!phone || !code) {
      return new Response(JSON.stringify({ success: false, error: 'اطلاعات ناقص است' }), { status: 400 });
    }

    const record = await env.DB.prepare(
      'SELECT code, expires_at FROM otp_codes WHERE phone = ?'
    ).bind(phone).first();

    if (!record) {
      return new Response(JSON.stringify({ success: false, error: 'کد تاییدی برای این شماره یافت نشد' }), { status: 404 });
    }

    if (Date.now() > record.expires_at) {
      return new Response(JSON.stringify({ success: false, error: 'کد تایید منقضی شده است. مجدداً درخواست دهید' }), { status: 400 });
    }

    if (record.code !== code.trim()) {
      return new Response(JSON.stringify({ success: false, error: 'کد تایید وارد شده اشتباه است' }), { status: 400 });
    }

    // پس از یک بار تایید موفق، رکورد حذف می‌شود تا قابل سوءاستفاده مجدد نباشد
    await env.DB.prepare('DELETE FROM otp_codes WHERE phone = ?').bind(phone).run();

    return new Response(JSON.stringify({ success: true, verified: true }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
  }
}
