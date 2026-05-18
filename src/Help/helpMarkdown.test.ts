import { describe, expect, it } from "vitest";
import {
  buildTableOfContents,
  getHelpSectionHref,
  slugify,
  stripMarkdown,
} from "./helpMarkdown";

describe("helpMarkdown", () => {
  it("strips inline markdown from heading text", () => {
    expect(
      stripMarkdown("`Tabs` **Guide** and [Help](https://example.com)"),
    ).toBe("Tabs Guide and Help");
  });

  it("builds stable slugs from English and Russian heading text", () => {
    expect(slugify("Keyboard Shortcuts")).toBe("keyboard-shortcuts");
    expect(slugify("Шорткаты клавиатуры")).toBe("шорткаты-клавиатуры");
    expect(slugify("!!!")).toBe("section");
  });

  it("extracts h2 and h3 headings with duplicate slug suffixes", () => {
    const toc = buildTableOfContents(`
# User Guide

## Tabs
### Mouse Actions
### Mouse Actions
#### Ignored
## \`Tabs\`
`);

    expect(toc).toEqual([
      {
        key: "2-tabs",
        level: 2,
        line: 4,
        slug: "tabs",
        text: "Tabs",
      },
      {
        key: "3-mouse-actions",
        level: 3,
        line: 5,
        slug: "mouse-actions",
        text: "Mouse Actions",
      },
      {
        key: "3-mouse-actions-2",
        level: 3,
        line: 6,
        slug: "mouse-actions-2",
        text: "Mouse Actions",
      },
      {
        key: "2-tabs-2",
        level: 2,
        line: 8,
        slug: "tabs-2",
        text: "Tabs",
      },
    ]);
  });

  it("builds help anchor hrefs for hash routing", () => {
    expect(getHelpSectionHref("tabs")).toBe("#/help#tabs");
    expect(getHelpSectionHref("mouse actions")).toBe("#/help#mouse%20actions");
  });
});
