// contact.js
// Renders the Add Contact form based on project_contact_fields config

const WORKER_URL = "https://your-worker-url"; // replace with your Worker URL
const SUPABASE_KEY = "your-supabase-key";     // replace with your key

// Fetch fields for a project and render grouped by section
async function renderAddContact(project) {
  const res = await fetch(
    `${WORKER_URL}/project_contact_fields?project=eq.${project}&order=sort_order.asc`,
    { headers: { apikey: SUPABASE_KEY } }
  );
  const fields = await res.json();

  // Group fields by section
  const grouped = fields.reduce((acc, f) => {
    const section = f.section || "General";
    if (!acc[section]) acc[section] = [];
    acc[section].push(f);
    return acc;
  }, {});

  const container = document.getElementById("addContactForm");
  container.innerHTML = "";

  Object.entries(grouped).forEach(([section, sectionFields]) => {
    // Section title
    const sectionHeader = document.createElement("h3");
    sectionHeader.className = "section-title"; // match portal style
    sectionHeader.textContent = section;
    container.appendChild(sectionHeader);

    // Section fields
    sectionFields.forEach(f => {
      const fieldWrapper = document.createElement("div");
      fieldWrapper.className = "form-group";

      const label = document.createElement("label");
      label.textContent = f.label;
      label.setAttribute("for", f.field_key);

      let input;

      if (f.lookup_type) {
        // Render dropdown bound to lookup group
        input = document.createElement("select");
        input.id = f.field_key;
        input.name = f.field_key;
        input.className = "form-control";

        // Fetch lookup values for this group
        fetch(`${WORKER_URL}/lookups?group=eq.${f.lookup_type}`, {
          headers: { apikey: SUPABASE_KEY }
        })
          .then(r => r.json())
          .then(values => {
            values.forEach(v => {
              const opt = document.createElement("option");
              opt.value = v.value;
              opt.textContent = v.label || v.value;
              input.appendChild(opt);
            });
          });
      } else {
        // Default text input
        input = document.createElement("input");
        input.type = "text";
        input.id = f.field_key;
        input.name = f.field_key;
        input.className = "form-control";
      }

      fieldWrapper.appendChild(label);
      fieldWrapper.appendChild(input);
      container.appendChild(fieldWrapper);
    });
  });
}

// Collect form values and post to Worker
async function saveContact(project) {
  const form = document.getElementById("addContactForm");
  const inputs = form.querySelectorAll("input, select");
  const contact = {};

  inputs.forEach(el => {
    contact[el.name] = el.value;
  });

  const res = await fetch(`${WORKER_URL}/contacts/add`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ project, contact })
  });

  const text = await res.text();
  console.log("Save contact response:", text);
}

// Example usage:
// renderAddContact("gtr");
// document.getElementById("saveBtn").onclick = () => saveContact("gtr");

// Example usage:
// Call this when the Add Contact tab loads
renderAddContact("gtr");

// Wire up the Save button
document.getElementById("saveBtn").onclick = () => saveContact("gtr");

// Export functions if you’re using modules
export { renderAddContact, saveContact };
