import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { receipt_id } = await req.json();
    if (!receipt_id) {
      return new Response(
        JSON.stringify({ error: "receipt_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get receipt
    const { data: receipt, error: receiptError } = await supabase
      .from("receipts")
      .select("*")
      .eq("id", receipt_id)
      .single();

    if (receiptError || !receipt) {
      return new Response(
        JSON.stringify({ error: "Receipt not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update status to processing
    await supabase
      .from("receipts")
      .update({ ocr_status: "processing" })
      .eq("id", receipt_id);

    // Get image from storage
    const { data: imageData, error: imageError } = await supabase.storage
      .from("receipts")
      .download(receipt.image_path);

    if (imageError || !imageData) {
      await supabase
        .from("receipts")
        .update({ ocr_status: "error" })
        .eq("id", receipt_id);
      return new Response(
        JSON.stringify({ error: "Image not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Convert to base64
    const arrayBuffer = await imageData.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    const mediaType = imageData.type || "image/jpeg";

    // Get categories for this household
    const { data: categories } = await supabase
      .from("categories")
      .select("id, name")
      .eq("household_id", receipt.household_id);

    const categoryList = (categories || [])
      .map((c: { id: string; name: string }) => `${c.id}: ${c.name}`)
      .join("\n");

    // Call Claude Haiku API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: base64,
                },
              },
              {
                type: "text",
                text: `このレシート画像を読み取り、以下のJSON形式で返してください。

利用可能なカテゴリ:
${categoryList}

JSONフォーマット:
{
  "store_name": "店舗名",
  "purchased_at": "YYYY-MM-DD",
  "total_amount": 合計金額(数値),
  "items": [
    {
      "name": "商品名",
      "quantity": 数量(数値),
      "unit_price": 単価(数値),
      "category_id": "最も適切なカテゴリID"
    }
  ]
}

注意:
- 金額は税込みの数値で返してください
- 日付が読み取れない場合は今日の日付を使ってください
- カテゴリIDは上記リストから最も適切なものを選んでください
- JSONのみを返してください、説明は不要です`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Claude API error:", errorBody);
      await supabase
        .from("receipts")
        .update({ ocr_status: "error" })
        .eq("id", receipt_id);
      return new Response(
        JSON.stringify({ error: "OCR API error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const claudeResponse = await response.json();
    const content = claudeResponse.content?.[0]?.text || "";

    // Parse JSON from response
    let parsed;
    try {
      // Extract JSON from potential markdown code block
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      console.error("Failed to parse OCR response:", content);
      await supabase
        .from("receipts")
        .update({ ocr_status: "error", ocr_raw: content })
        .eq("id", receipt_id);
      return new Response(
        JSON.stringify({ error: "Failed to parse OCR response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update receipt
    await supabase
      .from("receipts")
      .update({
        store_name: parsed.store_name || null,
        total_amount: parsed.total_amount || null,
        purchased_at: parsed.purchased_at || null,
        ocr_status: "done",
        ocr_raw: parsed,
      })
      .eq("id", receipt_id);

    // Insert items
    if (parsed.items && Array.isArray(parsed.items)) {
      const items = parsed.items.map(
        (item: {
          name: string;
          quantity?: number;
          unit_price: number;
          category_id?: string;
        }) => ({
          receipt_id,
          name: item.name || "不明",
          quantity: item.quantity || 1,
          unit_price: item.unit_price || 0,
          category_id: item.category_id || null,
        })
      );

      if (items.length > 0) {
        await supabase.from("receipt_items").insert(items);
      }
    }

    return new Response(
      JSON.stringify({ success: true, data: parsed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
