import React, { useEffect, useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import userGuideMarkdown from "../../docs/USER_GUIDE_EN.md?raw";

type TocItem = {
  key: string;
  level: 2 | 3;
  line: number;
  slug: string;
  text: string;
};

const stripMarkdown = (text: string) =>
  text
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_~]/g, "")
    .trim();

const slugify = (text: string) => {
  const normalized = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zа-яё0-9]+/giu, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "section";
};

const getNodeText = (children: React.ReactNode): string => {
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }

  if (Array.isArray(children)) {
    return children.map(getNodeText).join("");
  }

  if (React.isValidElement<{ children?: React.ReactNode }>(children)) {
    return getNodeText(children.props.children);
  }

  return "";
};

const buildTableOfContents = (markdown: string): TocItem[] => {
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

const scrollToGuideSection = (slug: string) => {
  document.getElementById(slug)?.scrollIntoView({ block: "start" });
};

const Help = () => {
  const tocItems = useMemo(
    () => buildTableOfContents(userGuideMarkdown),
    [],
  );

  useEffect(() => {
    const marker = "#/help#";
    if (!window.location.hash.startsWith(marker)) return;

    const slug = decodeURIComponent(window.location.hash.slice(marker.length));
    window.requestAnimationFrame(() => scrollToGuideSection(slug));
  }, []);

  const slugByLine = useMemo(
    () => new Map(tocItems.map((item) => [item.line, item.slug])),
    [tocItems],
  );

  const getHeadingSlug = (
    node: { position?: { start?: { line?: number } } } | undefined,
    children: React.ReactNode,
  ) => {
    const line = node?.position?.start?.line;
    if (typeof line === "number") {
      const slug = slugByLine.get(line);
      if (slug) return slug;
    }

    return slugify(stripMarkdown(getNodeText(children)));
  };

  const markdownComponents: Components = {
    a: ({ children, href }) => {
      const isExternal = href?.startsWith("http");

      return (
        <a
          className="text-emerald-300 underline decoration-emerald-500/50 underline-offset-4 transition hover:text-emerald-200"
          href={href}
          rel={isExternal ? "noopener noreferrer" : undefined}
          target={isExternal ? "_blank" : undefined}
        >
          {children}
        </a>
      );
    },
    code: ({ children, className }) => (
      <code
        className={`rounded border border-gray-700 bg-gray-950 px-1.5 py-0.5 text-[0.9em] font-semibold text-cyan-200 ${className ?? ""}`}
      >
        {children}
      </code>
    ),
    h1: ({ children }) => (
      <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
        {children}
      </h1>
    ),
    h2: ({ children, node }) => {
      const slug = getHeadingSlug(node, children);

      return (
        <h2
          className="scroll-mt-24 border-t border-gray-800 pt-8 text-2xl font-black text-white"
          id={slug}
        >
          {children}
        </h2>
      );
    },
    h3: ({ children, node }) => {
      const slug = getHeadingSlug(node, children);

      return (
        <h3
          className="scroll-mt-24 text-xl font-bold text-emerald-200"
          id={slug}
        >
          {children}
        </h3>
      );
    },
    li: ({ children }) => <li className="pl-1">{children}</li>,
    ol: ({ children }) => (
      <ol className="list-decimal space-y-2 pl-6 text-gray-300">{children}</ol>
    ),
    p: ({ children }) => (
      <p className="leading-7 text-gray-300">{children}</p>
    ),
    table: ({ children }) => (
      <div className="overflow-x-auto rounded-lg border border-gray-800">
        <table className="min-w-full divide-y divide-gray-800 text-sm">
          {children}
        </table>
      </div>
    ),
    tbody: ({ children }) => (
      <tbody className="divide-y divide-gray-800 bg-gray-950/50">
        {children}
      </tbody>
    ),
    td: ({ children }) => (
      <td className="px-3 py-2 align-top text-gray-300">{children}</td>
    ),
    th: ({ children }) => (
      <th className="bg-gray-800/80 px-3 py-2 text-left text-xs font-black uppercase tracking-wider text-gray-200">
        {children}
      </th>
    ),
    ul: ({ children }) => (
      <ul className="list-disc space-y-2 pl-6 text-gray-300">{children}</ul>
    ),
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-950 text-white">
      <div className="mx-auto grid w-full max-w-7xl gap-5 p-4 sm:p-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="rounded-lg border border-gray-800 bg-gray-900 p-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
          <div className="text-xs font-black uppercase tracking-widest text-emerald-300">
            Help
          </div>
          <h2 className="mt-2 text-lg font-bold text-white">
            User Guide
          </h2>
          <nav className="mt-4 space-y-1 text-sm" aria-label="Guide sections">
            {tocItems.map((item) => (
              <a
                key={item.key}
                className={`block rounded px-2 py-1.5 text-gray-300 transition hover:bg-gray-800 hover:text-white ${
                  item.level === 3 ? "ml-3 text-xs" : "font-semibold"
                }`}
                href={`#/help#${item.slug}`}
                onClick={(event) => {
                  event.preventDefault();
                  scrollToGuideSection(item.slug);
                  window.history.replaceState(
                    null,
                    "",
                    `#/help#${encodeURIComponent(item.slug)}`,
                  );
                }}
              >
                {item.text}
              </a>
            ))}
          </nav>
        </aside>

        <article className="min-w-0 rounded-lg border border-gray-800 bg-gray-900 p-5 shadow-xl sm:p-8">
          <ReactMarkdown
            components={markdownComponents}
            remarkPlugins={[remarkGfm]}
          >
            {userGuideMarkdown}
          </ReactMarkdown>
        </article>
      </div>
    </div>
  );
};

export default Help;
