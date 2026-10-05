// Dex-style id: lowercase letters and digits only.
// "Mr. Mime" → "mrmime", "Farfetch’d" / "Farfetch'd" → "farfetchd", "Kommo-o" → "kommoo".
export const toId = (text) => String(text ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

export const byName = (a, b) => a.name.localeCompare(b.name);

export const plural = (count, singular, pluralForm = `${singular}s`) =>
  `${count} ${count === 1 ? singular : pluralForm}`;
