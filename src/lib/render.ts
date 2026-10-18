// Template merge + a deliberately small Markdown subset renderer.
// All text is HTML-escaped before formatting, so neither templates nor merged
// customer data can inject markup into documents.

export function merge(template: string, ctx: Record<string, unknown>): { text: string; missing: string[] } {
  const missing: string[] = [];
  const text = template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path: string) => {
    const value = path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), ctx);
    if (value === undefined || value === null || value === "") {
      missing.push(path);
      return `[[MISSING: ${path}]]`;
    }
    return String(value);
  });
  return { text, missing: [...new Set(missing)] };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function inline(s: string): string {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[\[MISSING: ([\w.]+)\]\]/g, '<span class="doc-missing">[missing: $1]</span>');
}

export function renderMarkdown(src: string): string {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;
  let para: string[] = [];
  const flush = () => {
    if (para.length) out.push(`<p>${para.map(inline).join("<br/>")}</p>`);
    para = [];
  };

  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();

    if (t.startsWith(":::urdu")) {
      flush();
      const body: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== ":::") body.push(lines[i++]);
      i++;
      out.push(`<div class="doc-urdu" dir="rtl" lang="ur">${renderMarkdown(body.join("\n"))}</div>`);
      continue;
    }
    if (!t) {
      flush();
      i++;
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(t);
    if (h) {
      flush();
      out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
      i++;
      continue;
    }
    if (/^-{3,}$/.test(t)) {
      flush();
      out.push("<hr/>");
      i++;
      continue;
    }
    if (t.startsWith("|")) {
      flush();
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(lines[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
        i++;
      }
      const hasHeader = rows[1]?.every((c) => /^:?-{3,}:?$/.test(c));
      const head = hasHeader ? `<thead><tr>${rows[0].map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead>` : "";
      // short cells (dates, amounts, percentages) stay on one line
      const cell = (c: string) => `<td${c.replace(/\*\*/g, "").length <= 24 ? ' class="nw"' : ""}>${inline(c)}</td>`;
      const body = (hasHeader ? rows.slice(2) : rows).map((r) => `<tr>${r.map(cell).join("")}</tr>`).join("");
      out.push(`<div class="doc-table"><table>${head}<tbody>${body}</tbody></table></div>`);
      continue;
    }
    if (/^(-|\d+\.)\s+/.test(t)) {
      flush();
      const ordered = /^\d+\./.test(t);
      const items: string[] = [];
      while (i < lines.length && /^(-|\d+\.)\s+/.test(lines[i].trim())) {
        items.push(`<li>${inline(lines[i].trim().replace(/^(-|\d+\.)\s+/, ""))}</li>`);
        i++;
      }
      out.push(ordered ? `<ol>${items.join("")}</ol>` : `<ul>${items.join("")}</ul>`);
      continue;
    }
    if (t.startsWith(">")) {
      flush();
      const q: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) q.push(lines[i++].trim().replace(/^>\s?/, ""));
      out.push(`<blockquote>${q.map(inline).join("<br/>")}</blockquote>`);
      continue;
    }
    para.push(t);
    i++;
  }
  flush();
  return out.join("\n");
}
