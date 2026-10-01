export async function onRequestPost({ request, env }) {
  try {
    const { phone } = await request.json();

    if (!phone || !/^09\d{9}$/.test(phone)) {
      return new Response(JSON.stringify({ success: false, error: 'شماره موبایل معتبر نیست' }), { status: 400 });
    }

    // تولید کد ۴ رقمی تصادفی
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = Date.now() + (2 * 60 * 1000); // ۲ دقیقه مهلت

    // ذخیره در جدول موقت OTP
    await env.DB.prepare(`
      INSERT INTO otp_codes (phone, code, expires_at)
      VALUES (?, ?, ?)
      ON CONFLICT(phone) DO UPDATE SET
        code = excluded.code,
        expires_at = excluded.expires_at
    `).bind(phone, code, expiresAt).run();

    let smsStatus = 'not_configured';

    // ارسال واقعی پیامک در صورت وجود کلید
    if (env.KAVENEGAR_API_KEY) {
      try {
        const text = encodeURIComponent(`کد تایید معامله امن: ${code}\nمدت اعتبار: ۲ دقیقه`);
        // ارسال پیامک مستقیم کاوه‌نگار
        const kaveUrl = `https://api.kavenegar.com/v1/${env.KAVENEGAR_API_KEY}/sms/send.json?receptor=${phone}&message=${text}`;
        
        const smsRes = await fetch(kaveUrl);
        const smsData = await smsRes.json();
        
        if (smsData && smsData.return && smsData.return.status === 200) {
          smsStatus = 'sent';
        } else {
          smsStatus = 'kavenegar_error: ' + (smsData?.return?.message || 'خطا در وب‌سرویس');
        }
      } catch (err) {
        smsStatus = 'network_error: ' + err.message;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'درخواست ارسال شد',
      sms_status: smsStatus
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
      return new Response(JSON.stringify({ success: false, error: 'کد تاییدی برای این شماره صادر نشده است' }), { status: 404 });
    }

    if (Date.now() > record.expires_at) {
      return new Response(JSON.stringify({ success: false, error: 'کد تایید منقضی شده است' }), { status: 400 });
    }

    if (record.code !== code.trim()) {
      return new Response(JSON.stringify({ success: false, error: 'کد تایید اشتباه است' }), { status: 400 });
    }

    await env.DB.prepare('DELETE FROM otp_codes WHERE phone = ?').bind(phone).run();

    return new Response(JSON.stringify({ success: true, verified: true }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
  }
}
