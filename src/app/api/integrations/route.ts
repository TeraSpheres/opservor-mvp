import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, integrationKey } from "@/lib/supabase/admin";
import { getConnector } from "@/lib/connectors";

/* Connections.
 *
 * The only place in the product where a customer's API token is handled. It
 * arrives here from the browser once, is encrypted, and is never sent back —
 * not to the screen that stored it, not to anything.
 *
 * Two clients are used on purpose and the split is the whole security model:
 *
 *   the ordinary client  — runs as the signed-in user, answers "who are you
 *                          and which company are you allowed to touch"
 *   the admin client     — bypasses row-level security, and is used only for
 *                          the encrypted credential the user may never read
 *
 * Every route below establishes identity with the first before it uses the
 * second, and scopes the second to the company the first returned. An admin
 * client used without that check would happily act on any tenant.
 */

export const dynamic = "force-dynamic";

/** Who is asking, and which company are they in. Null means turn them away. */
async function whoIsAsking() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: appUser } = await supabase
    .from("app_user")
    .select("company_id, role")
    .eq("auth_id", user.id)
    .single();

  if (!appUser) return null;
  return { companyId: appUser.company_id as string, role: appUser.role as string };
}

/* ------------------------------------------------------------------ list */

export async function GET() {
  const who = await whoIsAsking();
  if (!who) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  // Read through the user's own session so row-level security applies. The
  // connection row carries no secret, so there is nothing here to protect
  // beyond the tenant boundary the policy already enforces.
  const supabase = createClient();
  const { data, error } = await supabase
    .from("integration_connection")
    .select("id, provider, label, status, base_url, last_sync_at, last_sync_status, last_sync_message")
    .eq("company_id", who.companyId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Which of them actually hold a credential. The admin client is needed
  // because nothing else can see that table — but only the ids come back,
  // never the secret.
  let withKey: string[] = [];
  try {
    const admin = createAdminClient();
    const { data: creds } = await admin
      .from("integration_credential")
      .select("connection_id")
      .eq("company_id", who.companyId);
    withKey = (creds ?? []).map((c) => c.connection_id as string);
  } catch {
    // Integrations are not configured on this deployment. The list still works.
  }

  return NextResponse.json({
    connections: (data ?? []).map((c) => ({ ...c, hasCredential: withKey.includes(c.id as string) })),
  });
}

/* ---------------------------------------------------------------- create */

export async function POST(request: Request) {
  const who = await whoIsAsking();
  if (!who) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  // Connecting a customer's own systems is an owner's decision, not a
  // convenience for whoever happens to be logged in.
  if (who.role !== "owner") {
    return NextResponse.json(
      { error: "Only an owner can connect a system." },
      { status: 403 }
    );
  }

  let body: { provider?: string; label?: string; baseUrl?: string; token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Could not read the request." }, { status: 400 });
  }

  const provider = (body.provider || "").trim().toLowerCase();
  const label = (body.label || "").trim();
  const token = (body.token || "").trim();
  const baseUrl = (body.baseUrl || "").trim() || undefined;

  if (!provider) return NextResponse.json({ error: "Choose a system." }, { status: 400 });
  if (!label) return NextResponse.json({ error: "Give this connection a name." }, { status: 400 });
  if (!token) return NextResponse.json({ error: "Paste the API key." }, { status: 400 });

  const connector = getConnector(provider);
  if (!connector) {
    return NextResponse.json({ error: `No adapter for ${provider} yet.` }, { status: 400 });
  }

  // Check the key works before storing it. A connection saved with a bad key
  // fails later, somewhere less obvious, and looks like a bug in the sync.
  let verified: { ok: boolean; message: string };
  try {
    verified = await connector.verify({
      baseUrl: baseUrl || connector.defaultBaseUrl,
      token,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not reach that system." },
      { status: 400 }
    );
  }
  if (!verified.ok) {
    return NextResponse.json({ error: verified.message }, { status: 400 });
  }

  let admin, key;
  try {
    admin = createAdminClient();
    key = integrationKey();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Integrations are not configured." },
      { status: 500 }
    );
  }

  // The connection row itself, scoped to the company the session proved.
  const { data: conn, error: connErr } = await admin
    .from("integration_connection")
    .upsert(
      {
        company_id: who.companyId,
        provider,
        label,
        base_url: baseUrl ?? null,
        status: "active",
      },
      { onConflict: "company_id,provider,label" }
    )
    .select("id")
    .single();

  if (connErr || !conn) {
    return NextResponse.json(
      { error: connErr?.message || "Could not save the connection." },
      { status: 400 }
    );
  }

  const { error: credErr } = await admin.rpc("integration_credential_set", {
    p_connection: conn.id,
    p_token: token,
    p_key: key,
  });

  if (credErr) {
    // Leave nothing half-made: a connection that looks configured and has no
    // key would fail on the first sync with a confusing message.
    await admin.from("integration_connection").delete().eq("id", conn.id);
    return NextResponse.json({ error: credErr.message }, { status: 400 });
  }

  await admin.rpc("integration_credential_verified", { p_connection: conn.id });

  return NextResponse.json({
    id: conn.id,
    message: verified.message,
  });
}

/* ---------------------------------------------------------------- remove */

export async function DELETE(request: Request) {
  const who = await whoIsAsking();
  if (!who) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (who.role !== "owner") {
    return NextResponse.json({ error: "Only an owner can remove a connection." }, { status: 403 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Which connection?" }, { status: 400 });

  const admin = createAdminClient();

  // Scoped to the caller's own company. Without this an owner of one tenant
  // could delete another tenant's connection by guessing an id.
  const { error } = await admin
    .from("integration_connection")
    .delete()
    .eq("id", id)
    .eq("company_id", who.companyId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // The credential row goes with it — the foreign key cascades.
  return NextResponse.json({ ok: true });
}
