export type TocItem = {
  key: string;
  level: 2 | 3;
  line: number;
  slug: string;
  text: string;
};

export const stripMarkdown = (text: string) =>
  text
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_~]/g, "")
    .trim();

export const slugify = (text: string) => {
  const normalized = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zа-яё0-9]+/giu, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "section";
};

export const buildTableOfContents = (markdown: string): TocItem[] => {
  const usedSlugs = new Map<string, number>();

  return markdown
    .split(/\r?\n/)
    .map((line, index) => {
      const match = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line);
      if (!match) return null;

      const level = match[1].length as TocItem["level"];
      const text = stripMarkdown(match[2]);
      const baseSlug = slugify(text);
      const duplicateIndex = usedSlugs.get(baseSlug) ?? 0;
      usedSlugs.set(baseSlug, duplicateIndex + 1);

      const slug =
        duplicateIndex === 0 ? baseSlug : `${baseSlug}-${duplicateIndex + 1}`;

      return {
        key: `${level}-${slug}`,
        level,
        line: index + 1,
        slug,
        text,
      };
    })
    .filter((item): item is TocItem => item !== null);
};

export const getHelpSectionHref = (slug: string) =>
  `#/help#${encodeURIComponent(slug)}`;
