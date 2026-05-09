function getByPath(obj, path) {
  if (!obj || !path) return "";
  return String(path)
    .split(".")
    .reduce((acc, key) => {
      if (acc == null) return undefined;
      return acc[key];
    }, obj);
}

export function extractTemplateVariables(input = "") {
  const set = new Set();
  const regex = /{{\s*([a-zA-Z0-9_.]+)\s*}}/g;
  let match;

  while ((match = regex.exec(String(input)))) {
    set.add(match[1]);
  }

  return Array.from(set);
}

export function renderTemplateString(input = "", variables = {}) {
  return String(input).replace(/{{\s*([a-zA-Z0-9_.]+)\s*}}/g, (_, key) => {
    const value = getByPath(variables, key);
    if (value == null) return "";
    return String(value);
  });
}

export function stripHtml(html = "") {
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<\/(p|div|h1|h2|h3|li|tr|br)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export function renderTemplate({
  subject = "",
  html = "",
  text = "",
  variables = {},
}) {
  const renderedSubject = renderTemplateString(subject, variables);
  const renderedHtml = renderTemplateString(html, variables);
  const renderedText = text
    ? renderTemplateString(text, variables)
    : stripHtml(renderedHtml);

  return {
    subject: renderedSubject,
    html: renderedHtml,
    text: renderedText,
  };
}
