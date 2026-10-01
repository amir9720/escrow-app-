export async function onRequestPost({ request, env }) {
  try {
    const { dealId } = await request.json();

    if (!dealId) {
      return new Response(JSON.stringify({ success: false, error: 'شناسه معامله الزامی است' }), { status: 400 });
    }

    // ۱. دریافت معامله از دیتابیس D1
    const deal = await env.DB.prepare('SELECT * FROM deals WHERE id = ?').bind(dealId).first();

    if (!deal) {
      return new Response(JSON.stringify({ success: false, error: 'معامله یافت نشد' }), { status: 404 });
    }

    if (deal.status !== 'pending_payment' && deal.status !== 'held') {
      // اگر قبلاً پرداخت شده باشد
      if (deal.status === 'held' || deal.status === 'shipped' || deal.status === 'released') {
        return new Response(JSON.stringify({ success: false, error: 'وجه این معامله قبلاً پرداخت شده است.' }), { status: 400 });
      }
    }

    // مبلغ زیبال به ریال است (تومان ضرب‌در ۱۰)
    const amountInRials = parseInt(deal.amount, 10) * 10;
    const origin = new URL(request.url).origin;
    const callbackUrl = `${origin}/api/verify?dealId=${deal.id}`;

    // مرچنت زیبال (اگر کلید واقعی ست نشده باشد، از zibal به عنوان سندباکس تستی استفاده می‌شود)
    const merchant = env.ZIBAL_MERCHANT || 'zibal';

    // ۲. ارسال درخواست به زیبال جهت دریافت توکن پرداخت
    const zibalRes = await fetch('https://gateway.zibal.ir/v1/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant: merchant,
        amount: amountInRials,
        callbackUrl: callbackUrl,
        description: `پرداخت امن معامله ${deal.title} (#${deal.id})`,
        mobile: deal.buyer_phone || ''
      })
    });

    const zibalData = await zibalRes.json();

    if (zibalData.result === 100) {
      // ذخیره trackId در معامله
      await env.DB.prepare('UPDATE deals SET tracking_code = ? WHERE id = ?')
        .bind(zibalData.trackId.toString(), deal.id)
        .run();

      const payUrl = `https://gateway.zibal.ir/start/${zibalData.trackId}`;
      return new Response(JSON.stringify({ success: true, payUrl: payUrl }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      return new Response(JSON.stringify({ success: false, error: `خطای زیبال: کد ${zibalData.result} - ${zibalData.message || ''}` }), { status: 500 });
    }

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
  }
}
