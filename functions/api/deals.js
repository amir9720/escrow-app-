export async function onRequestPost(context) {
  try {
    const data = await context.request.json();
    const dealId = "deal_" + Math.random().toString(36).substring(2, 8);

    // پاسخ تایید ثبت معامله
    return new Response(JSON.stringify({
      success: true,
      dealId: dealId,
      message: "معامله با موفقیت در سرور ثبت شد",
      data: data
    }), {
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 400 });
  }
}
