// /api/create-note.js
// Diagnostic Worker to confirm routing + execution

export default async function handler(req, res) {
  try {
    // 1. Handle GET for browser testing
    if (req.method === "GET") {
      return res
        .status(200)
        .send("✅ create-note Worker is alive. Send a POST request with JSON.");
    }

    // 2. Only allow POST for real usage
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    // 3. Log the incoming payload (for debugging)
    console.log("Incoming payload:", req.body);

    // 4. Return a simple JSON response
    return res.json({
      status: "Worker executed",
      received: req.body,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error("Worker error:", err);
    return res.status(500).json({ error: "Unexpected server error" });
  }
}
