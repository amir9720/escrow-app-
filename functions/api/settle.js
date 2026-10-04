export async function onRequestPost({ request, env }) {
  try {
    const { dealId } = await request.json();

    if (!dealId) {
      return new Response(JSON.stringify({ success: false, error: 'شناسه معامله الزامی است' }), { status: 400 });
    }

    // ۱. دریافت مشخصات معامله از دیتابیس
    const deal = await env.DB.prepare('SELECT * FROM deals WHERE id = ?').bind(dealId).first();

    if (!deal) {
      return new Response(JSON.stringify({ success: false, error: 'معامله یافت نشد' }), { status: 404 });
    }

    if (deal.status === 'released') {
      return new Response(JSON.stringify({ success: false, error: 'این معامله قبلاً تسویه شده است' }), { status: 400 });
    }

    // محاسبه مبالغ (تومان)
    const totalAmount = parseInt(deal.amount, 10);
    const feeRate = 0.03; // کارمزد ۳ درصد
    let sellerPayout = totalAmount;

    if (deal.fee_payer === 'seller') {
      sellerPayout = Math.floor(totalAmount * (1 - feeRate));
    } else if (deal.fee_payer === 'split') {
      sellerPayout = Math.floor(totalAmount * (1 - (feeRate / 2)));
    }

    // مبلغ زیبال برای حواله پایا به ریال است
    const payoutInRials = sellerPayout * 10;
    let cleanSheba = (deal.seller_sheba || '').replace(/^IR/i, '').replace(/\s+/g, '');

    // ۲. ارسال درخواست تسویه پایا به زیبال (در صورت فعال بودن توکن تسویه)
    let payoutStatus = 'simulated';
    if (env.ZIBAL_PAYOUT_TOKEN && cleanSheba.length === 24) {
      try {
        const payoutRes = await fetch('https://api.zibal.ir/v1/facility/payout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.ZIBAL_PAYOUT_TOKEN}`
          },
          body: JSON.stringify({
            amount: payoutInRials,
            iban: 'IR' + cleanSheba,
            description: `تسویه معامله امن #${deal.id}`
          })
        });

        const payoutData = await payoutRes.json();
        payoutStatus = payoutData.result === 100 ? 'sent_to_bank' : `failed_${payoutData.result}`;
      } catch (err) {
        console.error('Zibal Payout Error:', err);
      }
    }

    // ۳. به‌روزرسانی وضعیت معامله به تسویه‌شده در دیتابیس
    await env.DB.prepare("UPDATE deals SET status = 'released' WHERE id = ?")
      .bind(dealId)
      .run();

    return new Response(JSON.stringify({
      success: true,
      message: 'تسویه با موفقیت انجام شد',
      payout_amount: sellerPayout,
      payout_status: payoutStatus
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
  }
}
