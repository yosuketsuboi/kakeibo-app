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

    // Convert to base64 (chunked to avoid stack overflow)
    const arrayBuffer = await imageData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    const base64 = btoa(binary);
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
        max_tokens: 8192,
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

    // Check if response was truncated
    const stopReason = claudeResponse.stop_reason;
    const wasTruncated = stopReason === "max_tokens";

    // Parse JSON from response
    let parsed;
    let wasRepaired = false;
    try {
      // Strip markdown code block wrapper if present
      let jsonStr = content.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");

      // Try parsing as-is first
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        // If truncated, try to repair: close open arrays/objects
        // Remove trailing incomplete item (after last comma in items array)
        const lastCompleteItem = jsonStr.lastIndexOf("},");
        if (lastCompleteItem !== -1) {
          jsonStr = jsonStr.substring(0, lastCompleteItem + 1);
          // Close the items array and root object
          jsonStr += "]}";
          parsed = JSON.parse(jsonStr);
          wasRepaired = true;
          console.log("Repaired truncated JSON successfully");
        } else {
          throw new Error("Cannot repair JSON");
        }
      }
    } catch (e) {
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

    // Flag truncation in parsed data
    if (wasTruncated || wasRepaired) {
      parsed._truncated = true;
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
