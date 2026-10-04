// تابع اعتبارسنجی الگوریتم ۱۰ رقمی کدملی ایران
function isValidNationalId(code) {
  if (!code || !/^\d{10}$/.test(code)) return false;
  if (/^(\d)\1{9}$/.test(code)) return false; // ارقام یکسان مثل 1111111111

  const check = parseInt(code[9], 10);
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(code[i], 10) * (10 - i);
  }
  const rem = sum % 11;
  return (rem < 2 && check === rem) || (rem >= 2 && check === 11 - rem);
}

export async function onRequestPost({ request, env }) {
  try {
    const { phone, nationalCode } = await request.json();

    if (!phone || !/^09\d{9}$/.test(phone)) {
      return new Response(JSON.stringify({ success: false, error: 'شماره موبایل نامعتبر است' }), { status: 400 });
    }

    if (nationalCode) {
      if (!isValidNationalId(nationalCode)) {
        return new Response(JSON.stringify({ success: false, error: 'کد ملی وارد شده نامعتبر است' }), { status: 400 });
      }

      // استعلام از شاهکار زیبال در صورت تعریف توکن استعلام
      if (env.ZIBAL_INQUIRY_TOKEN) {
        try {
          const shahkarRes = await fetch('https://api.zibal.ir/v1/facility/shahkarInquiry', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${env.ZIBAL_INQUIRY_TOKEN}`
            },
            body: JSON.stringify({
              mobile: phone,
              nationalCode: nationalCode
            })
          });
          const shahkarData = await shahkarRes.json();
          // اگر نتیجه ۱۰۰ نباشد یا تطابق منفی باشد
          if (shahkarData.result !== 100 || !shahkarData.data?.matched) {
            return new Response(JSON.stringify({
              success: false,
              error: 'کد ملی با شماره موبایل ثبت‌نام‌کننده مطابقت ندارد (عدم تطابق سامانه شاهکار)'
            }), { status: 400 });
          }
        } catch (e) {
          console.error('Shahkar Inquiry Error:', e);
        }
      }
    }

    // تولید کد ۴ رقمی موقت
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = Date.now() + (2 * 60 * 1000);

    await env.DB.prepare(`
      INSERT INTO otp_codes (phone, code, expires_at)
      VALUES (?, ?, ?)
      ON CONFLICT(phone) DO UPDATE SET
        code = excluded.code,
        expires_at = excluded.expires_at
    `).bind(phone, code, expiresAt).run();

    // پیامک واقعی با کاوه‌نگار (در صورت فعال شدن خط)
    if (env.KAVENEGAR_API_KEY) {
      try {
        const text = encodeURIComponent(`کد تایید معامله امن: ${code}`);
        await fetch(`https://api.kavenegar.com/v1/${env.KAVENEGAR_API_KEY}/sms/send.json?receptor=${phone}&message=${text}`);
      } catch (err) {
        console.error('SMS Error:', err);
      }
    }

    return new Response(JSON.stringify({ success: true, message: 'کد تایید آماده ارسال است' }), {
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

    // حالت موقت تست (تا زمان تایید خط رسمی کاوه‌نگار)
    if (code.trim() === '1234') {
      return new Response(JSON.stringify({ success: true, verified: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const record = await env.DB.prepare('SELECT code, expires_at FROM otp_codes WHERE phone = ?').bind(phone).first();

    if (!record) {
      return new Response(JSON.stringify({ success: false, error: 'کد تاییدی صادر نشده است' }), { status: 404 });
    }

    if (Date.now() > record.expires_at) {
      return new Response(JSON.stringify({ success: false, error: 'کد منقضی شده است' }), { status: 400 });
    }

    if (record.code !== code.trim()) {
      return new Response(JSON.stringify({ success: false, error: 'کد وارد شده اشتباه است' }), { status: 400 });
    }

    await env.DB.prepare('DELETE FROM otp_codes WHERE phone = ?').bind(phone).run();

    return new Response(JSON.stringify({ success: true, verified: true }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
  }
}
