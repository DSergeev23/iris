const CYRILLIC: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

export function departmentSlugBase(name: string) {
  return name.trim().toLowerCase().replace(/№/g, " ").split("").map((character) => CYRILLIC[character] ?? character).join("")
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 60).replace(/-+$/g, "") || "department";
}

export function uniqueDepartmentSlug(name: string, usedSlugs: Iterable<string>) {
  const base = departmentSlugBase(name);
  const used = new Set(usedSlugs);
  if (!used.has(base)) return base;

  for (let suffix = 2; ; suffix += 1) {
    const suffixText = `-${suffix}`;
    const candidate = `${base.slice(0, 60 - suffixText.length)}${suffixText}`;
    if (!used.has(candidate)) return candidate;
  }
}
