export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const data = await request.json();

    if (!env.DB) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "دیتابیس DB به این پروژه متصل نیست! تنظیمات Bindings را بررسی کنید." 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" }
      });
    }

    const dealId = "deal_" + Math.random().toString(36).substring(2, 8);

    await env.DB.prepare(
      `INSERT INTO deals (id, title, amount, buyer_phone, seller_phone, seller_sheba, fee_payer)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      dealId,
      data.title || "معامله بدون عنوان",
      Number(data.amount) || 0,
      data.buyer_phone || "",
      data.seller_phone || "",
      data.seller_sheba || "",
      data.fee_payer || "buyer"
    ).run();

    return new Response(JSON.stringify({
      success: true,
      dealId: dealId,
      message: "معامله با موفقیت در دیتابیس ذخیره شد"
    }), {
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }
}
