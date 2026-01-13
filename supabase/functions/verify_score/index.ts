import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface VerifyScoreRequest {
  user_id: string;
  score: number;
  wallet_address: string;
  social_handle: string;
  tx_hash: string;
  username: string;
}

async function verifyTransactionOnBase(txHash: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.basescan.org/api?module=transaction&action=gettxreceipt&txhash=${txHash}&apikey=${Deno.env.get("BASESCAN_API_KEY") || ""}`
    );
    const data = await response.json();
    return data.status === "1" && data.result?.status === "1";
  } catch (error) {
    console.error("Error verifying transaction:", error);
    return false;
  }
}

function validateInput(
  req: VerifyScoreRequest
): { valid: boolean; error?: string } {
  if (!req.user_id || typeof req.user_id !== "string") {
    return { valid: false, error: "Invalid user_id" };
  }
  if (typeof req.score !== "number" || req.score < 0 || req.score > 10000) {
    return { valid: false, error: "Invalid score" };
  }
  if (!req.wallet_address || !/^0x[a-fA-F0-9]{40}$/.test(req.wallet_address)) {
    return { valid: false, error: "Invalid wallet address" };
  }
  if (
    req.social_handle &&
    (typeof req.social_handle !== "string" || req.social_handle.length > 100)
  ) {
    return { valid: false, error: "Invalid social handle" };
  }
  if (!req.tx_hash || !/^0x[a-fA-F0-9]{64}$/.test(req.tx_hash)) {
    return { valid: false, error: "Invalid transaction hash" };
  }
  if (!req.username || req.username.length > 255) {
    return { valid: false, error: "Invalid username" };
  }
  return { valid: true };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: VerifyScoreRequest = await req.json();

    const validation = validateInput(body);
    if (!validation.valid) {
      return new Response(JSON.stringify({ error: validation.error }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const isValidTx = await verifyTransactionOnBase(body.tx_hash);

    if (!isValidTx) {
      return new Response(
        JSON.stringify({ error: "Transaction not verified on Base", verified: false }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: existing } = await supabase
      .from("leaderboard")
      .select("*")
      .eq("user_id", body.user_id)
      .maybeSingle();

    let result;
    if (existing) {
      if (body.score <= existing.score) {
        return new Response(
          JSON.stringify({
            error: "Score not higher than existing score",
            verified: false,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      result = await supabase
        .from("leaderboard")
        .update({
          score: body.score,
          wallet_address: body.wallet_address,
          social_handle: body.social_handle,
          tx_hash: body.tx_hash,
          minted: true,
          verified: true,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", body.user_id)
        .select()
        .single();
    } else {
      result = await supabase
        .from("leaderboard")
        .insert([
          {
            user_id: body.user_id,
            username: body.username,
            score: body.score,
            wallet_address: body.wallet_address,
            social_handle: body.social_handle,
            tx_hash: body.tx_hash,
            minted: true,
            verified: true,
          },
        ])
        .select()
        .single();
    }

    if (result.error) {
      console.error("Database error:", result.error);
      return new Response(
        JSON.stringify({ error: "Failed to update leaderboard", verified: false }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        verified: true,
        message: "Score verified and recorded on-chain",
        data: result.data,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", verified: false }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
