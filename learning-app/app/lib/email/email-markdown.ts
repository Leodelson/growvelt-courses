const escape = (value: string) => value.replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]!);
// Intentionally small formatting vocabulary. Raw HTML, images, scripts and video
// are always text; no browser HTML is trusted by the email renderer.
export function renderEmailMarkdown(value: string) {
  const inline = (text: string) => escape(text).replace(/\*\*([^*\n]+)\*\*/g,"<strong>$1</strong>").replace(/_([^_\n]+)_/g,"<em>$1</em>");
  return value.split(/\n{2,}/).map(block => {
    const lines = block.split("\n");
    if (lines.every(line => /^-\s+/.test(line))) return `<ul style="padding-left:24px;color:#f4f4f5;line-height:1.62">${lines.map(line=>`<li>${inline(line.replace(/^-\s+/,""))}</li>`).join("")}</ul>`;
    return `<p style="margin:0 0 16px;font-size:16px;line-height:1.62;color:#f4f4f5">${lines.map(inline).join("<br />")}</p>`;
  }).join("");
}
