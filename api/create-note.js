// /api/create-note.js
// Node-compatible GitHub Worker (serverless function)

if (req.method === "GET") {
  return res.status(200).send("✅ create-note Worker is alive. POST to this endpoint.");
}

import { DateTime } from "luxon";
import OpenAI from "openai";

// IMPORTANT: GitHub Workers give you (req, res) like Express
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const {
      project,
      contact_id = null,
      note_date = null,
      note,
      source = "manual",
      metadata = {}
    } = req.body;

    if (!project || !note) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // -----------------------------
    // 1. Fetch project timezone
    // -----------------------------
    const tzRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/projects_config?project=eq.${project}&select=timezone`,
      {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE}`
        }
      }
    );

    const tzData = await tzRes.json();
    const timezone = tzData?.[0]?.timezone || "UTC";

    // -----------------------------
    // 2. Determine final note_date
    // -----------------------------
    const todayInTZ = DateTime.now().setZone(timezone).toISODate();
    const finalNoteDate = note_date || todayInTZ;

    // -----------------------------
    // 3. Insert note
    // -----------------------------
    const noteInsertRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/notes_history`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: process.env.SUPABASE_SERVICE_ROLE,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE}`
        },
        body: JSON.stringify({
          project,
          contact_id,
          note_date: finalNoteDate,
          note,
          from_name: metadata.from_name || null,
          from_email: metadata.from_email || null,
          subject: metadata.subject || null,
          sent_date: metadata.sent_date || null,
          source
        })
      }
    );

    const noteInsert = await noteInsertRes.json();
    const note_id = noteInsert?.[0]?.id;

    if (!note_id) {
      return res.status(500).json({ error: "Failed to insert note" });
    }

    // -----------------------------
    // 4. Run AI extraction
    // -----------------------------
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const aiResponse = await client.responses.create({
      model: "gpt-4.1",
      reasoning: { effort: "medium" },
      input: [
        {
          role: "system",
          content: "You are an AI that extracts structured data from notes..."
        },
        {
          role: "user",
          content: note
        }
      ]
    });

    const aiText = aiResponse.output[0].content[0].text;
    const parsed = JSON.parse(aiText);

    const relationships = parsed.relationships || [];
    const todos = parsed.todos || [];

    // -----------------------------
    // 5. Insert relationships
    // -----------------------------
    let relationshipsCreated = 0;

    for (const rel of relationships) {
      if (!rel.raw_name) continue;

      const relRes = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/relationships`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: process.env.SUPABASE_SERVICE_ROLE,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE}`
          },
          body: JSON.stringify({
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
          })
        }
      );

      if (relRes.ok) relationshipsCreated++;
    }

    // -----------------------------
    // 6. Insert todos
    // -----------------------------
    let todosCreated = 0;

    for (const todo of todos) {
      if (!todo.task) continue;

      const todoRes = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/todos`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: process.env.SUPABASE_SERVICE_ROLE,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE}`
          },
          body: JSON.stringify({
            project,
            contact_id,
            note_id,
            task: todo.task,
            due_date: todo.due_date || null,
            priority: todo.priority || null,
            ai_confidence: todo.confidence || null,
            source_text: todo.source_text || null,
            status: "pending"
          })
        }
      );

      if (todoRes.ok) todosCreated++;
    }

    // -----------------------------
    // 7. Return success
    // -----------------------------
    return res.json({
      note_id,
      relationships_created: relationshipsCreated,
      todos_created: todosCreated
    });

  } catch (err) {
    console.error("Worker error:", err);
    return res.status(500).json({ error: "Unexpected server error" });
  }
}
