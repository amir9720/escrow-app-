export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const { id, action } = await request.json();

    if (!id || !action) {
      return new Response(JSON.stringify({ success: false, error: "اطلاعات ناقص است" }), {
        status: 400,
        headers: { "Content-Type": "application/json; charset=utf-8" }
      });
    }

    let newStatus = "";
    if (action === "pay") {
      newStatus = "in_escrow"; // وجه وارد امانت سایت شد
    } else if (action === "complete") {
      newStatus = "completed"; // معامله تایید و وجه برای فروشنده آزاد شد
    }

    await env.DB.prepare("UPDATE deals SET status = ? WHERE id = ?").bind(newStatus, id).run();

    return new Response(JSON.stringify({ success: true, status: newStatus }), {
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }
}
