// /api/create_note.js
// Cloudflare Worker version — full, copy‑paste‑safe

import { DateTime } from "luxon";
import OpenAI from "openai";

/* ============================================================
   EXTRACTION PROMPT (unchanged)
============================================================ */
const EXTRACTION_PROMPT = `...`;
// (KEEP YOUR FULL PROMPT HERE — unchanged)

/* ============================================================
   SAFE JSON PARSER
============================================================ */
function safeParseExtraction(text) {
  if (!text || typeof text !== "string") {
    return { summary: "", relationships: [], todos: [], followups_raw: [] };
  }

  let cleaned = text.trim();

  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```[a-zA-Z0-9]*\n?/, "").replace(/```$/, "").trim();
  }

  try {
    const parsed = JSON.parse(cleaned);
    return {
      summary: parsed.summary || "",
      relationships: Array.isArray(parsed.relationships) ? parsed.relationships : [],
      todos: Array.isArray(parsed.todos) ? parsed.todos : [],
      followups_raw: Array.isArray(parsed.followups_raw) ? parsed.followups_raw : []
    };
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        return {
          summary: parsed.summary || "",
          relationships: Array.isArray(parsed.relationships) ? parsed.relationships : [],
          todos: Array.isArray(parsed.todos) ? parsed.todos : [],
          followups_raw: Array.isArray(parsed.followups_raw) ? parsed.followups_raw : []
        };
      } catch {}
    }
  }

  return { summary: "", relationships: [], todos: [], followups_raw: [] };
}

/* ============================================================
   CANONICAL createNote() FUNCTION
============================================================ */
async function createNote({
  project,
  contact_id = null,
  note_date = null,
  note,
  source = "manual",
  metadata = {},
  supabase,
  openaiApiKey
}) {
  try {
    if (!project || !note) {
      throw new Error("Missing required fields: project or note");
    }

    // 1. Fetch project timezone
    const { data: tzData, error: tzError } = await supabase
      .from("projects_config")
      .select("timezone")
      .eq("project", project)
      .single();

    if (tzError) throw tzError;

    const timezone = tzData?.timezone || "UTC";

    // 2. Determine final note_date
    const todayInTZ = DateTime.now().setZone(timezone).toISODate();
    const finalNoteDate = note_date || todayInTZ;

    // 3. Insert note
    const { data: noteInsert, error: noteError } = await supabase
      .from("notes_history")
      .insert([
        {
          project,
          contact_id,
          note_date: finalNoteDate,
          note,
          from_name: metadata.from_name || null,
          from_email: metadata.from_email || null,
          subject: metadata.subject || null,
          sent_date: metadata.sent_date || null,
          source
        }
      ])
      .select()
      .single();

    if (noteError) throw noteError;

    const note_id = noteInsert.id;

    // 4. AI extraction
    const client = new OpenAI({ apiKey: openaiApiKey });

    const aiResponse = await client.responses.create({
      model: "gpt-4.1",
      reasoning: { effort: "medium" },
      input: [
        { role: "system", content: EXTRACTION_PROMPT },
        { role: "user", content: note }
      ]
    });

    const aiText =
      aiResponse?.output?.[0]?.content?.[0]?.text || "";

    const extraction = safeParseExtraction(aiText);

    const summary = extraction.summary || "";
    const relationships = extraction.relationships || [];
    const todos = extraction.todos || [];
    const followups_raw = extraction.followups_raw || [];

    // 5. Patch summary
    if (summary) {
      await supabase
        .from("notes_history")
        .update({ summary })
        .eq("id", note_id);
    }

    // 6. Insert relationships
    let relationshipsCreated = 0;

    for (const rel of relationships) {
      if (!rel || !rel.raw_name) continue;

      const { error: relError } = await supabase
        .from("relationships")
        .insert([
          {
            project,
            note_id,
            contact_id: null,
            raw_name: rel.raw_name,
            first_name: rel.first_name || null,
            last_name: rel.last_name || null,
            role: rel.role || null,
            context: rel.context || null,
            source_text: rel.source_text || null,
            status: "pending"
          }
        ]);

      if (!relError) relationshipsCreated++;
    }

    // 7. Insert todos
    let todosCreated = 0;

    for (const todo of todos) {
      if (!todo || !todo.task) continue;

      const { error: todoError } = await supabase
        .from("todos")
        .insert([
          {
            project,
            contact_id,
            note_id,
            task: todo.task,
            due_date: todo.due_date || null,
            priority: todo.priority || null,
            ai_confidence: todo.confidence ?? null,
            source_text: todo.source_text || null,
            status: "pending"
          }
        ]);

      if (!todoError) todosCreated++;
    }

    return {
      success: true,
      note_id,
      summary,
      relationships_created: relationshipsCreated,
      todos_created: todosCreated,
      relationships,
      todos,
      followups_raw
    };

  } catch (err) {
    return { success: false, error: err.message };
  }
}

/* ============================================================
   WORKER ENTRYPOINT (REQUIRED)
============================================================ */
export default {
  async fetch(request, env) {
    // CORS
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
      return new Response("OK", { headers: cors });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: cors
      });
    }

    try {
      const body = await request.json();

      const result = await createNote({
        project: body.project,
        contact_id: body.contact_id || null,
        note_date: body.note_date || null,
        note: body.note,
        source: body.source || "manual",
        metadata: body.metadata || {},
        supabase: env.supabase,
        openaiApiKey: env.OPENAI_API_KEY
      });

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" }
      });

    } catch (err) {
      return new Response(
        JSON.stringify({ success: false, error: err.message }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }
  }
};
