# DataBook Viewer — Chrome Extension

A Chrome extension that detects DataBook (`.databook.md`) files and renders them as clean, formatted documents with toggleable frontmatter and hidden block controls.

## Installation (unpacked extension)

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select this `databook-viewer` folder
5. The DataBook Viewer icon appears in your extensions bar

## Usage

Open any DataBook file in Chrome:
- Local files: `File → Open File` or drag a `.databook.md` file onto a Chrome tab
- Web: navigate to any URL serving a DataBook as raw text

The extension auto-detects DataBook content by checking the YAML frontmatter `type:` field. When a DataBook is detected, the raw text is replaced with a formatted document view.

## View Controls

### Toolbar buttons (top of page)
| Button | Action |
|---|---|
| **Frontmatter** | Show / hide the YAML metadata card |
| **Hidden** | Reveal / conceal blocks marked `mode=hidden` |

### Keyboard shortcuts (when page has focus)
| Key | Action |
|---|---|
| `F` | Toggle frontmatter |
| `H` | Toggle hidden blocks |

Toggle state is saved per origin in `localStorage` and restored on next visit.

### Extension popup
Click the DataBook Viewer icon in the extensions bar to see:
- Whether a DataBook is active on the current tab
- Document title, type, and version
- Visual toggle switches for frontmatter and hidden blocks

## What gets rendered

| DataBook element | Rendered as |
|---|---|
| YAML frontmatter | Collapsible metadata card with syntax highlighting |
| Prose sections | Formatted HTML (headings, tables, blockquotes, lists, inline code) |
| Fenced data blocks | Code blocks with language label, block ID, and mode badge |
| `mode=hidden` blocks | Hatched placeholder (content revealed when Hidden toggle is ON) |
| `mode=reference` blocks | Faded code block |
| `mode=executed` blocks | Code block with endpoint metadata in header |

## Supported block types

`turtle` · `turtle12` · `shacl` · `sparql` · `sparql-update` · `json-ld` · `trig` · `manifest` · `transformer-library` · `processor-registry` · `prompt` · `yaml` · `json` · `javascript` · `python` · `bash`

## Detection scope

The extension runs on all URLs but only activates when:
1. The page content is raw text (not rendered HTML)
2. The text begins with `---` YAML frontmatter
3. The frontmatter contains `type: databook`, `type: transformer-library`, or `type: processor-registry`

Pages that do not match are completely unaffected.

## Icons

The placeholder icons (solid teal squares) should be replaced with the SVG source in `icons/icon.svg` rendered to 16×16, 48×48, and 128×128 PNG files. Use Inkscape, rsvg-convert, or any SVG-to-PNG converter.

## DataBook specification

https://github.com/kurtcagle/databook

---

*DataBook Viewer v1.0.0 — © 2026 Kurt Cagle / Chloe Shannon — HolonGraph*
