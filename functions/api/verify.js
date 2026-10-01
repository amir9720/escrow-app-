export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const dealId = url.searchParams.get('dealId');
    const trackId = url.searchParams.get('trackId');
    const success = url.searchParams.get('success');
    const status = url.searchParams.get('status');

    const origin = url.origin;

    // اگر پرداخت در درگاه لغو شده یا ناموفق بوده باشد
    if (success !== '1' && status !== '2') {
      return Response.redirect(`${origin}/deal.html#${dealId}?payment=failed`, 302);
    }

    const merchant = env.ZIBAL_MERCHANT || 'zibal';

    // استعلام و تایید وریفای از زیبال
    const verifyRes = await fetch('https://gateway.zibal.ir/v1/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant: merchant,
        trackId: trackId
      })
    });

    const verifyData = await verifyRes.json();

    // کد ۱۰۰ (موفق) یا ۲۰۱ (قبلاً تایید شده)
    if (verifyData.result === 100 || verifyData.result === 201) {
      // تغییر وضعیت معامله در D1 به held (وجه در امانت سایت)
      await env.DB.prepare("UPDATE deals SET status = 'held' WHERE id = ?")
        .bind(dealId)
        .run();

      return Response.redirect(`${origin}/deal.html#${dealId}?payment=success`, 302);
    } else {
      return Response.redirect(`${origin}/deal.html#${dealId}?payment=error&code=${verifyData.result}`, 302);
    }

  } catch (error) {
    return new Response(`خطا در بررسی پرداخت: ${error.message}`, { status: 500 });
  }
}
