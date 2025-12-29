// /api/create_note.js
// Canonical note creation logic for UI + staging + future webhook

import { DateTime } from "luxon";
import OpenAI from "openai";

// IMPORTANT:
// This module exports ONE function: createNote()
// You call it from your UI or staging processor.

export async function createNote({
  project,
  contact_id = null,
  note_date = null,
  note,
  source = "manual",
  metadata = {},
  supabase,        // pass your Supabase client
  openaiApiKey     // pass your OpenAI key
}) {
  try {
    if (!project || !note) {
      throw new Error("Missing required fields: project or note");
    }

    // ----------------------------------------
    // 1. Fetch project timezone
    // ----------------------------------------
    const { data: tzData, error: tzError } = await supabase
      .from("projects_config")
      .select("timezone")
      .eq("project", project)
      .single();

    if (tzError) throw tzError;

    const timezone = tzData?.timezone || "UTC";

    // ----------------------------------------
    // 2. Determine final note_date
    // ----------------------------------------
    const todayInTZ = DateTime.now().setZone(timezone).toISODate();
    const finalNoteDate = note_date || todayInTZ;

    // ----------------------------------------
    // 3. Insert note into notes_history
    // ----------------------------------------
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

    // ----------------------------------------
    // 4. Run AI extraction
    // ----------------------------------------
    const client = new OpenAI({ apiKey: openaiApiKey });

    const aiResponse = await client.responses.create({
      model: "gpt-4.1",
      reasoning: { effort: "medium" },
      input: [
        {
          role: "system",
          content: `
You extract structured data from notes.
Return JSON with:
{
  "relationships": [
    {
      "raw_name": "",
      "first_name": "",
      "last_name": "",
      "role": "",
      "context": "",
      "source_text": ""
    }
  ],
  "todos": [
    {
      "task": "",
      "due_date": "",
      "priority": "",
      "confidence": "",
      "source_text": ""
    }
  ]
}
`
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

    // ----------------------------------------
    // 5. Insert relationships
    // ----------------------------------------
    let relationshipsCreated = 0;

    for (const rel of relationships) {
      if (!rel.raw_name) continue;

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

    // ----------------------------------------
    // 6. Insert todos
    // ----------------------------------------
    let todosCreated = 0;

    for (const todo of todos) {
      if (!todo.task) continue;

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
            ai_confidence: todo.confidence || null,
            source_text: todo.source_text || null,
            status: "pending"
          }
        ]);

      if (!todoError) todosCreated++;
    }

    // ----------------------------------------
    // 7. Return results
    // ----------------------------------------
    return {
      success: true,
      note_id,
      relationships_created: relationshipsCreated,
      todos_created: todosCreated
    };

  } catch (err) {
    console.error("createNote() error:", err);
    return {
      success: false,
      error: err.message || "Unexpected error"
    };
  }
}
