export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, Prefer"
    };

    if (request.method === "OPTIONS") {
      return new Response("OK", { headers: cors });
    }

    // GET /lookups/list?project=...
    if (url.pathname === "/lookups/list" && request.method === "GET") {
      const project = url.searchParams.get("project");
      const endpoint = `${env.SUPABASE_URL}/rest/v1/lookups?project=eq.${project}&order=lookup_type,sort_order`;
      const res = await fetch(endpoint, {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`,
          "Content-Type": "application/json",
          Prefer: "return=representation"
        }
      });
      const text = await res.text();
      try {
        const data = JSON.parse(text);
        return new Response(JSON.stringify({ status: "ok", lookups: data }), {
          headers: { ...cors, "Content-Type": "application/json" }
        });
      } catch {
        return new Response(JSON.stringify({ status: "error", error: "Invalid JSON", details: text }), {
          status: 500,
          headers: { ...cors, "Content-Type": "application/json" }
        });
      }
    }

    // POST /lookups/addGroup
    if (url.pathname === "/lookups/addGroup" && request.method === "POST") {
      const body = await request.json();
      const payload = {
        lookup_type: body.lookup_type,
        value: "",
        sort_order: 0,
        is_active: true,
        project: body.project,
        created_at: new Date().toISOString()
      };
      const endpoint = `${env.SUPABASE_URL}/rest/v1/lookups`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`,
          "Content-Type": "application/json",
          Prefer: "return=representation"
        },
        body: JSON.stringify(payload)
      });
      return new Response(await res.text(), { headers: cors });
    }

    // POST /lookups/addValue
    if (url.pathname === "/lookups/addValue" && request.method === "POST") {
      const body = await request.json();
      const payload = {
        lookup_type: body.lookup_type,
        value: body.value,
        sort_order: 0,
        is_active: true,
        project: body.project,
        created_at: new Date().toISOString()
      };
      const endpoint = `${env.SUPABASE_URL}/rest/v1/lookups`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`,
          "Content-Type": "application/json",
          Prefer: "return=representation"
        },
        body: JSON.stringify(payload)
      });
      return new Response(await res.text(), { headers: cors });
    }

    // PATCH /lookups/edit/:id
    if (url.pathname.startsWith("/lookups/edit/") && request.method === "PATCH") {
      const id = url.pathname.split("/").pop();
      const body = await request.json();
      const endpoint = `${env.SUPABASE_URL}/rest/v1/lookups?id=eq.${id}`;
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`,
          "Content-Type": "application/json",
          Prefer: "return=representation"
        },
        body: JSON.stringify(body.updates)
      });
      return new Response(await res.text(), { headers: cors });
    }

    // DELETE /lookups/delete/:id
    if (url.pathname.startsWith("/lookups/delete/") && request.method === "DELETE") {
      const id = url
