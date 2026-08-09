export function onRequest(context) {
  const url = new URL(context.request.url);
  const project = url.searchParams.get('project') || '';

  const manifest = {
    name: "RedUmbrella Pro",
    short_name: "RedUmbrella",
    start_url: project ? `/?project=${encodeURIComponent(project)}` : '/',
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      { src: "/images/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/images/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/images/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/images/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ]
  };

  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json" }
  });
}
