// /api/create_note.js
// Canonical note creation logic for UI + staging + future webhook

import { DateTime } from "luxon";
import OpenAI from "openai";

// ----------------------------------------
// Canonical extraction prompt
// ----------------------------------------
const EXTRACTION_PROMPT = `
You are an AI that extracts structured data from a note.
The note may come from:
- a user-typed note,
- an email from someone,
- an email to someone,
- an AI-generated summary of a Zoom meeting,
- or any other text source.

You must NOT assume:
- who wrote the note,
- who the note is addressed to,
- the perspective or intent of the author,
- any relationships not explicitly stated,
- any tasks not explicitly stated,
- any dates not explicitly stated,
- any meaning behind pronouns (he, she, they) unless the person is explicitly named.

Your ONLY output must be a valid JSON object with this exact shape:

{
  "summary": "",
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
      "confidence": 0,
      "source_text": ""
    }
  ],
  "followups_raw": [
    {
      "text": "",
      "source_text": ""
    }
  ]
}

SUMMARY RULES:
- Write a concise 3–6 sentence summary of the note.
- Capture the key events, decisions, and context.
- Ignore email signatures, disclaimers, footers, and quoted reply chains.
- Do NOT add information that is not explicitly in the note.
- Do NOT include opinions, interpretations, or assumptions.
- For long notes, prioritize the main events and decisions.
- For short notes, summarize only what is explicitly stated.

RULES FOR RELATIONSHIPS:
- Extract ONLY people explicitly mentioned in the note.
- Do NOT invent people.
- "raw_name" must be the exact text from the note.
- Split into first_name and last_name when possible; otherwise null.
- If only initials are provided, use them as raw_name and set first_name/last_name to null.
- "role" is the person's role if explicitly stated (e.g., attorney, buyer).
- "context" is a short description of how they relate to the situation.
- "source_text" must be the exact sentence or phrase from the note.
- Do NOT infer identities from pronouns.
- Do NOT merge different people with the same name.
- Do NOT extract organizations as people unless explicitly stated as a person.

RULES FOR TODOS:
- Extract ONLY actionable tasks explicitly stated or strongly implied.
- Do NOT invent tasks.
- "task" must be a short actionable phrase.
- "due_date" must be ISO format if explicitly stated; otherwise null.
- Do NOT convert relative dates (e.g., “tomorrow”, “next week”, “in 3 weeks”) into absolute dates.
- "priority" may be "high", "medium", or "low" if implied; otherwise null.
- "confidence" must be a number between 0 and 1.
- "source_text" must be the exact sentence or phrase from the note.
- Do NOT infer tasks from vague statements unless an explicit action is stated.
- Do NOT create todos from email signatures or disclaimers.

FOLLOW-UP RULES:
- Extract ALL follow-up language, whether vague or specific.
- ALWAYS add follow-up language to the "followups_raw" array with:
  {
    "text": "<the follow-up phrase>",
    "source_text": "<the exact sentence or phrase from the note>"
  }

SPECIFIC FOLLOW-UPS:
- If the follow-up includes BOTH:
  (1) a clear, explicit action AND
  (2) a clear, explicit date,
  THEN also create a todo entry in the "todos" array.
- Examples:
  "Call John on March 3rd"
  "Email Sarah on 1/15"
  "Follow up Friday at 2pm"
- These must produce BOTH:
  - a todo
  - a followups_raw entry

VAGUE OR RELATIVE FOLLOW-UPS:
- If the follow-up is vague or uses relative timing (e.g., “soon”, “next week”, “tomorrow”, “in 3 weeks”),
  DO NOT create a todo.
- Only add it to "followups_raw".
- Do NOT guess or convert relative dates into absolute dates.
- Do NOT infer missing details.

ADDITIONAL RULES:
- Ignore timestamps, speaker labels, and section headers unless they contain actionable content.
- Treat all input as plain text; do not assume structure based on formatting.
- If nothing is found, return empty arrays.
- Do NOT include any text outside the JSON.
- Do NOT explain your reasoning.
- Do NOT include comments.
- Do NOT include markdown or code fences.
- JSON must not contain trailing commas.
- All strings must be valid JSON strings with proper escaping.
- Output MUST be valid JSON.
`;

// ----------------------------------------
// Helper: safe JSON extraction parsing
// ----------------------------------------
function safeParseExtraction(text) {
  if (!text || typeof text !== "string") {
    return {
      summary: "",
      relationships: [],
      todos: [],
      followups_raw: []
    };
  }

  let cleaned = text.trim();

  // Strip code fences if model ever adds them
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```[a-zA-Z0-9]*\n?/, "").replace(/```$/, "").trim();
  }

  // Try direct parse
  try {
    const parsed = JSON.parse(cleaned);
    return {
      summary: parsed.summary || "",
      relationships: Array.isArray(parsed.relationships) ? parsed.relationships : [],
      todos: Array.isArray(parsed.todos) ? parsed.todos : [],
      followups_raw: Array.isArray(parsed.followups_raw) ? parsed.followups_raw : []
    };
  } catch {
    // Try to salvage a JSON object from within the text
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
      } catch {
        // fall through
      }
    }
  }

  // Fallback: empty structure
  return {
    summary: "",
    relationships: [],
    todos: [],
    followups_raw: []
  };
}

// ----------------------------------------
// Canonical createNote()
// ----------------------------------------
export async function createNote({
  project,
  contact_id = null,
  note_date = null,
  note,
  source = "manual",
  metadata = {},
  supabase,        // Supabase client
  openaiApiKey     // OpenAI key
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
    // 2. Determine final note_date (project-local)
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
    // 4. Run AI extraction (summary + relationships + todos + followups_raw)
    // ----------------------------------------
    const client = new OpenAI({ apiKey: openaiApiKey });

    const aiResponse = await client.responses.create({
      model: "gpt-4.1",
      reasoning: { effort: "medium" },
      input: [
        {
          role: "system",
          content: EXTRACTION_PROMPT
        },
        {
          role: "user",
          content: note
        }
      ]
    });

    const aiText =
      aiResponse?.output?.[0]?.content?.[0]?.text ||
      "";

    const extraction = safeParseExtraction(aiText);

    const summary = extraction.summary || "";
    const relationships = extraction.relationships || [];
    const todos = extraction.todos || [];
    const followups_raw = extraction.followups_raw || [];

    // ----------------------------------------
    // 5. Patch summary back onto the note (if column exists)
    // ----------------------------------------
    if (summary) {
      try {
        await supabase
          .from("notes_history")
          .update({ summary })
          .eq("id", note_id);
      } catch (e) {
        console.error("createNote() warning: failed to patch summary:", e);
      }
    }

    // ----------------------------------------
    // 6. Insert relationships
    //    (keeps your existing "relationships" table)
    // ----------------------------------------
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

      if (!relError) {
        relationshipsCreated++;
      } else {
        console.error("createNote() relationship insert error:", relError);
      }
    }

    // ----------------------------------------
    // 7. Insert todos
    // ----------------------------------------
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

      if (!todoError) {
        todosCreated++;
      } else {
        console.error("createNote() todo insert error:", todoError);
      }
    }

    // ----------------------------------------
    // 8. Return results (including followups_raw for UI)
    // ----------------------------------------
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
    console.error("createNote() error:", err);
    return {
      success: false,
      error: err.message || "Unexpected error"
    };
  }
}
