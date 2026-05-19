// DataBook Viewer — content.js
// Detects DataBook content on any page and renders it as a formatted document.

(function () {
  'use strict';

  const NS = 'dbv';

  // ── Raw text extraction ────────────────────────────────────────────────────

  function getRawText() {
    const bodyPre = document.querySelector('body > pre');
    if (bodyPre) return bodyPre.textContent;

    if (document.body &&
        document.body.childNodes.length === 1 &&
        document.body.firstChild.nodeType === Node.TEXT_NODE) {
      return document.body.textContent;
    }

    const ghRaw = document.querySelector('.plain-text-body pre, .blob-wrapper pre');
    if (ghRaw) return ghRaw.textContent;

    return null;
  }

  // ── DataBook detection ─────────────────────────────────────────────────────

  function isDataBook(text) {
    if (!text || text.length < 20) return false;
    const fm = /^---[\r\n]([\s\S]*?)[\r\n]---/.exec(text);
    if (!fm) return false;
    return /\btype:\s*(databook|transformer-library|processor-registry)\b/.test(fm[1]);
  }

  // ── Frontmatter extraction ─────────────────────────────────────────────────

  function extractFrontmatter(text) {
    const m = /^---[\r\n]([\s\S]*?)[\r\n]---([\r\n][\s\S]*)?$/.exec(text);
    if (m) return { yaml: m[1], body: m[2] || '' };
    return { yaml: '', body: text };
  }

  function yamlScalar(yaml, key) {
    const m = new RegExp(`(?:^|\\n)${key}:\\s*["\']?([^\\n"\'#]+)["\']?`).exec(yaml);
    return m ? m[1].trim() : '';
  }

  // ── Body parser ────────────────────────────────────────────────────────────

  const DATABOOK_KEY_RE = /^<!--\s*databook:([\w-]+):\s*(.+?)\s*-->$/;
  const DIRECTIVE_RE    = /^<!--\s*((?:[\w-]+=\S+\s*)+)-->\s*$/;

  function parseDirectiveLine(line) {
    const m = DIRECTIVE_RE.exec(line.trim());
    if (!m) return {};
    return Object.fromEntries(
      m[1].trim().split(/\s+/)
        .filter(t => t.includes('='))
        .map(t => t.split('=', 2))
    );
  }

  function parseBody(bodyText) {
    const lines = bodyText.split(/\r?\n/);
    const segs  = [];
    let prose   = [];
    let i       = 0;

    function flushProse() {
      const text = prose.join('\n').trim();
      if (text) segs.push({ type: 'prose', content: text });
      prose = [];
    }

    while (i < lines.length) {
      const line = lines[i];

      if (line.trim().startsWith('<!--')) {
        const meta = {}, directives = {};
        let j = i;
        while (j < lines.length && lines[j].trim().startsWith('<!--')) {
          const l  = lines[j].trim();
          const dk = DATABOOK_KEY_RE.exec(l);
          if (dk)               meta[dk[1]] = dk[2];
          else if (DIRECTIVE_RE.test(l)) Object.assign(directives, parseDirectiveLine(l));
          j++;
        }
        if (j < lines.length && /^```/.test(lines[j])) {
          flushProse();
          const label = lines[j].slice(3).trim();
          j++;
          const blockLines = [];
          while (j < lines.length && !/^```\s*$/.test(lines[j])) {
            blockLines.push(lines[j]);
            j++;
          }
          j++;
          segs.push({ type: 'block', label, meta, directives, content: blockLines.join('\n') });
          i = j;
          continue;
        }
      }

      if (/^```/.test(line)) {
        flushProse();
        const label = line.slice(3).trim();
        i++;
        const blockLines = [];
        while (i < lines.length && !/^```\s*$/.test(lines[i])) {
          blockLines.push(lines[i]);
          i++;
        }
        i++;
        segs.push({ type: 'block', label, meta: {}, directives: {}, content: blockLines.join('\n') });
        continue;
      }

      prose.push(line);
      i++;
    }

    flushProse();
    return segs;
  }

  // ── HTML escape ────────────────────────────────────────────────────────────

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ╔═══════════════════════════════════════════════════════════════════════════╗
  // ║  SYNTAX HIGHLIGHTING                                                      ║
  // ╚═══════════════════════════════════════════════════════════════════════════╝

  // Generic sticky-regex tokenizer.
  // Each rule: { re: /pattern/y, type: 'token-type' }
  // Processes left-to-right; first matching rule wins.
  function tokenizeSticky(code, rules) {
    const tokens = [];
    let pos = 0;
    const len = code.length;

    while (pos < len) {
      let matched = false;
      for (const rule of rules) {
        rule.re.lastIndex = pos;
        const m = rule.re.exec(code);
        if (m) {
          tokens.push({ type: rule.type, text: m[0] });
          pos += m[0].length;
          matched = true;
          break;
        }
      }
      if (!matched) {
        // Absorb one character as plain text to avoid infinite loops
        tokens.push({ type: 'plain', text: code[pos] });
        pos++;
      }
    }
    return tokens;
  }

  function tokensToHtml(tokens) {
    return tokens.map(t => {
      const e = esc(t.text);
      if (t.type === 'plain' || t.type === 'whitespace') return e;
      return `<span class="hl-${t.type}">${e}</span>`;
    }).join('');
  }

  // ── Turtle / SHACL ─────────────────────────────────────────────────────────
  // Token priority order matters: longer / more specific patterns first.

  const TURTLE_RULES = [
    // Line comments
    { re: /#[^\n]*/y,                                  type: 'comment'    },
    // Triple-quoted strings (must precede single-quoted)
    { re: /"""[\s\S]*?(?:"""|$)/y,                     type: 'string'     },
    { re: /'''[\s\S]*?(?:'''|$)/y,                     type: 'string'     },
    // Single-quoted strings with escape handling
    { re: /"(?:[^"\\]|\\.)*"/y,                        type: 'string'     },
    { re: /'(?:[^'\\]|\\.)*'/y,                        type: 'string'     },
    // @prefix / @base directives (before generic @lang)
    { re: /@(?:prefix|base)\b/iy,                      type: 'keyword'    },
    // Language tags  @en  @en-GB
    { re: /@[a-zA-Z]+(?:-[a-zA-Z0-9]+)*/y,            type: 'langtag'    },
    // Datatype marker ^^
    { re: /\^\^/y,                                     type: 'punct'      },
    // Angle-bracket IRIs
    { re: /<[^>]*>/y,                                  type: 'iri'        },
    // Blank node labels  _:name
    { re: /_:[\w.-]+/y,                                type: 'bnode'      },
    // Prefixed names with local part  prefix:local
    { re: /[a-zA-Z_][\w-]*:[a-zA-Z_][\w.-]*/y,        type: 'prefixed'   },
    // Empty-prefix names  :local
    { re: /:[a-zA-Z_][\w.-]*/y,                        type: 'prefixed'   },
    // Prefix declarations  prefix:  (trailing colon, no local name)
    { re: /[a-zA-Z_][\w-]*:/y,                         type: 'pfx-decl'   },
    // Floating point (before integer to avoid partial match)
    { re: /[+-]?\d*\.\d+(?:[eE][+-]?\d+)?/y,           type: 'number'     },
    { re: /[+-]?\d+(?:[eE][+-]?\d+)?/y,                type: 'number'     },
    // Literals: true / false
    { re: /\b(?:true|false)\b/y,                        type: 'boolean'    },
    // Keyword: a  (rdf:type shorthand)
    { re: /\ba\b/y,                                     type: 'keyword'    },
    // Punctuation
    { re: /[.,;()\[\]{}]/y,                             type: 'punct'      },
    // Whitespace (preserve exactly)
    { re: /\s+/y,                                       type: 'whitespace' },
  ];

  function highlightTurtle(code) {
    return tokensToHtml(tokenizeSticky(code, TURTLE_RULES));
  }

  // ── SPARQL ─────────────────────────────────────────────────────────────────

  // Built as regex literals to avoid costly RegExp constructor on every call.
  // `iy` = case-insensitive + sticky.

  const SPARQL_KW_RE = /\b(?:SELECT|CONSTRUCT|DESCRIBE|ASK|WHERE|FROM|NAMED|GRAPH|OPTIONAL|UNION|MINUS|FILTER|BIND|VALUES|SERVICE|PREFIX|BASE|DISTINCT|REDUCED|ALL|ORDER|GROUP|HAVING|LIMIT|OFFSET|BY|ASC|DESC|AS|IN|NOT|IF|EXISTS|COALESCE|SEPARATOR|UNDEF|TRUE|FALSE|A)\b/iy;

  const SPARQL_FN_RE = /\b(?:isIRI|isURI|isBlank|isLiteral|isNumeric|BOUND|STR|LANG|DATATYPE|IRI|URI|BNODE|STRDT|STRLANG|LANGMATCHES|STRLEN|SUBSTR|UCASE|LCASE|STRSTARTS|STRENDS|CONTAINS|ENCODE_FOR_URI|CONCAT|REGEX|REPLACE|ABS|ROUND|CEIL|FLOOR|RAND|NOW|YEAR|MONTH|DAY|HOURS|MINUTES|SECONDS|TIMEZONE|TZ|MD5|SHA1|SHA256|SHA384|SHA512|COUNT|SUM|MIN|MAX|AVG|SAMPLE|GROUP_CONCAT|SAMETERM)\b/iy;

  const SPARQL_RULES = [
    { re: /#[^\n]*/y,                                  type: 'comment'    },
    { re: /"""[\s\S]*?(?:"""|$)/y,                     type: 'string'     },
    { re: /'''[\s\S]*?(?:'''|$)/y,                     type: 'string'     },
    { re: /"(?:[^"\\]|\\.)*"/y,                        type: 'string'     },
    { re: /'(?:[^'\\]|\\.)*'/y,                        type: 'string'     },
    // SPARQL variables  ?var  $var
    { re: /[?$][a-zA-Z_][\w]*/y,                       type: 'variable'   },
    // Angle-bracket IRIs
    { re: /<[^>]*>/y,                                   type: 'iri'        },
    // Language tags & datatype markers (after strings)
    { re: /@[a-zA-Z]+(?:-[a-zA-Z0-9]+)*/y,             type: 'langtag'    },
    { re: /\^\^/y,                                      type: 'punct'      },
    // Blank nodes
    { re: /_:[\w.-]+/y,                                 type: 'bnode'      },
    // Keywords before prefixed names (word-boundary safe)
    { re: SPARQL_KW_RE,                                 type: 'keyword'    },
    // Built-in functions
    { re: SPARQL_FN_RE,                                 type: 'builtin'    },
    // Prefixed names
    { re: /[a-zA-Z_][\w-]*:[a-zA-Z_][\w.-]*/y,         type: 'prefixed'   },
    { re: /:[a-zA-Z_][\w.-]*/y,                         type: 'prefixed'   },
    { re: /[a-zA-Z_][\w-]*:/y,                          type: 'pfx-decl'   },
    // Numbers
    { re: /[+-]?\d*\.\d+(?:[eE][+-]?\d+)?/y,            type: 'number'     },
    { re: /[+-]?\d+(?:[eE][+-]?\d+)?/y,                 type: 'number'     },
    // SPARQL path / set operators
    { re: /[|^!*/+?]/y,                                 type: 'op'         },
    // General punctuation
    { re: /[.,;{}()\[\]]/y,                             type: 'punct'      },
    { re: /\s+/y,                                       type: 'whitespace' },
  ];

  function highlightSPARQL(code) {
    return tokensToHtml(tokenizeSticky(code, SPARQL_RULES));
  }

  // ── JSON-LD / JSON ─────────────────────────────────────────────────────────

  // JSON-LD @-keywords: highlight as keyword when appearing as a string key or value.
  const JSONLD_AT_RE = /"@(?:context|type|id|value|language|container|graph|base|vocab|list|set|reverse|index|nest|prefix|protected|version|import|propagate|direction)"/iy;

  const JSONLD_RULES = [
    // @-keywords (must precede generic string to win)
    { re: JSONLD_AT_RE,                                 type: 'keyword'    },
    // String keys (followed by colon + whitespace)
    { re: /"(?:[^"\\]|\\.)*"(?=\s*:)/y,                type: 'json-key'   },
    // String values
    { re: /"(?:[^"\\]|\\.)*"/y,                        type: 'string'     },
    // Literals
    { re: /\b(?:true|false|null)\b/y,                   type: 'boolean'    },
    // Numbers
    { re: /-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/y,         type: 'number'     },
    // Punctuation
    { re: /[{}[\]:,]/y,                                 type: 'punct'      },
    { re: /\s+/y,                                       type: 'whitespace' },
  ];

  function highlightJSONLD(code) {
    return tokensToHtml(tokenizeSticky(code, JSONLD_RULES));
  }

  // ── YAML (for yaml fence blocks) ──────────────────────────────────────────

  const YAML_RULES = [
    { re: /#[^\n]*/y,                                   type: 'comment'    },
    // Multi-line strings
    { re: /"""[\s\S]*?"""/y,                            type: 'string'     },
    { re: /"(?:[^"\\]|\\.)*"/y,                        type: 'string'     },
    { re: /'(?:[^']*)'/ ,                               type: 'string'     },
    // Keys (word chars before colon)
    { re: /^[ \t]*[\w-]+(?=\s*:)/my,                   type: 'y-key'      },
    // List markers
    { re: /^[ \t]*-(?=\s)/my,                           type: 'y-bullet'   },
    // Booleans / null
    { re: /\b(?:true|false|null|yes|no|on|off)\b/iy,   type: 'boolean'    },
    // IRIs (values that look like URIs)
    { re: /https?:\/\/[^\s#,\]})>]+/y,                 type: 'iri'        },
    // Numbers
    { re: /-?\d+(?:\.\d+)?/y,                           type: 'number'     },
    // Block scalars
    { re: /[|>][+-]?/y,                                 type: 'punct'      },
    { re: /[:{}\[\],]/y,                                type: 'punct'      },
    { re: /\s+/y,                                       type: 'whitespace' },
  ];

  function highlightYAMLBlock(code) {
    return tokensToHtml(tokenizeSticky(code, YAML_RULES));
  }

  // ── Dispatch ───────────────────────────────────────────────────────────────

  function highlightCode(code, lang) {
    const l = (lang || '').toLowerCase();
    try {
      if (l === 'turtle' || l === 'turtle12' || l === 'shacl') return highlightTurtle(code);
      if (l === 'sparql' || l === 'sparql-update')              return highlightSPARQL(code);
      if (l === 'json-ld' || l === 'json')                      return highlightJSONLD(code);
      if (l === 'yaml')                                          return highlightYAMLBlock(code);
    } catch (e) {
      // Highlighter error — fall back to plain escaped text
      console.warn('[DataBook Viewer] Highlight error for lang:', lang, e);
    }
    return esc(code);
  }

  // ╔═══════════════════════════════════════════════════════════════════════════╗
  // ║  MARKDOWN RENDERING                                                       ║
  // ╚═══════════════════════════════════════════════════════════════════════════╝

  function renderInline(text) {
    return esc(text)
      .replace(/\*\*([^*]+)\*\*/g,       '<strong>$1</strong>')
      .replace(/__([^_\s][^_]*)__/g,     '<strong>$1</strong>')
      .replace(/\*([^*\s][^*]*)\*/g,     '<em>$1</em>')
      .replace(/_([^_\s][^_]*)_/g,       '<em>$1</em>')
      .replace(/`([^`]+)`/g,             '<code>$1</code>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  }

  function renderMarkdown(md) {
    // Strip HTML comments (DataBook metadata — not prose)
    md = md.replace(/<!--[\s\S]*?-->/g, '');

    const lines = md.split(/\r?\n/);
    const out   = [];
    let i       = 0;

    while (i < lines.length) {
      const line = lines[i];
      if (line.trim() === '') { i++; continue; }

      // Horizontal rule
      if (/^(?:---+|\*\*\*+|___+)\s*$/.test(line)) { out.push('<hr>'); i++; continue; }

      // ATX heading
      const hm = /^(#{1,6})\s+(.+)$/.exec(line);
      if (hm) {
        const lvl = hm[1].length;
        const id  = hm[2].toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
        out.push(`<h${lvl} id="${id}">${renderInline(hm[2])}</h${lvl}>`);
        i++; continue;
      }

      // Blockquote
      if (line.startsWith('>')) {
        const bq = [];
        while (i < lines.length && lines[i].startsWith('>')) { bq.push(lines[i].slice(1).trimStart()); i++; }
        out.push(`<blockquote>${renderMarkdown(bq.join('\n'))}</blockquote>`);
        continue;
      }

      // Unordered list
      if (/^[-*+]\s/.test(line)) {
        const items = [];
        while (i < lines.length && /^[-*+]\s/.test(lines[i])) {
          items.push(`<li>${renderInline(lines[i].replace(/^[-*+]\s+/, ''))}</li>`);
          i++;
        }
        out.push(`<ul>${items.join('')}</ul>`);
        continue;
      }

      // Ordered list
      if (/^\d+\.\s/.test(line)) {
        const items = [];
        while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
          items.push(`<li>${renderInline(lines[i].replace(/^\d+\.\s+/, ''))}</li>`);
          i++;
        }
        out.push(`<ol>${items.join('')}</ol>`);
        continue;
      }

      // Table
      if (line.includes('|') && i + 1 < lines.length && /^\|?[-:| ]+\|/.test(lines[i + 1])) {
        const parseCells = row => row.split('|').slice(1, -1).map(c => c.trim());
        const heads = parseCells(line);
        i += 2;
        const tbody = [];
        while (i < lines.length && lines[i].includes('|')) { tbody.push(parseCells(lines[i])); i++; }
        const thHtml = heads.map(c => `<th>${renderInline(c)}</th>`).join('');
        const tbHtml = tbody.map(row => `<tr>${row.map(c => `<td>${renderInline(c)}</td>`).join('')}</tr>`).join('');
        out.push(`<div class="${NS}-table-wrap"><table><thead><tr>${thHtml}</tr></thead><tbody>${tbHtml}</tbody></table></div>`);
        continue;
      }

      // Paragraph
      const para = [];
      while (
        i < lines.length &&
        lines[i].trim() !== '' &&
        !/^(?:#{1,6}\s|[-*+]\s|\d+\.\s|>|---+|\*\*\*+|___+|```|<!--)/.test(lines[i]) &&
        !lines[i].includes('|')
      ) { para.push(lines[i].trim()); i++; }
      if (para.length) out.push(`<p>${renderInline(para.join(' '))}</p>`);
    }

    return out.join('\n');
  }

  // ── YAML frontmatter syntax highlight ─────────────────────────────────────

  function highlightYaml(yaml) {
    return yaml.split('\n').map(line => {
      if (/^\s*#/.test(line))
        return `<span class="${NS}-y-comment">${esc(line)}</span>`;
      const kv = /^(\s*)([\w_-]+)(\s*:\s*)(.*)$/.exec(line);
      if (kv)
        return `${esc(kv[1])}<span class="${NS}-y-key">${esc(kv[2])}</span>` +
               `<span class="${NS}-y-punct">${esc(kv[3])}</span>` +
               `<span class="${NS}-y-val">${esc(kv[4])}</span>`;
      const li = /^(\s*-\s*)(.*)$/.exec(line);
      if (li)
        return `<span class="${NS}-y-bullet">${esc(li[1])}</span>` +
               `<span class="${NS}-y-val">${esc(li[2])}</span>`;
      return esc(line);
    }).join('\n');
  }

  // ╔═══════════════════════════════════════════════════════════════════════════╗
  // ║  COMPONENT RENDERING                                                      ║
  // ╚═══════════════════════════════════════════════════════════════════════════╝

  // ── Frontmatter card ───────────────────────────────────────────────────────

  function renderFrontmatterCard(yaml) {
    return `
<section class="${NS}-fm" id="${NS}-fm" aria-label="Document frontmatter">
  <div class="${NS}-fm-hd">
    <span class="${NS}-fm-title">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <rect x=".75" y=".75" width="10.5" height="10.5" rx="1.25" stroke="currentColor" stroke-width="1.5"/>
        <path d="M3 4h6M3 6h4" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/>
      </svg>
      Frontmatter
    </span>
    <span class="${NS}-fm-hint">YAML · toggle with <kbd>F</kbd></span>
  </div>
  <pre class="${NS}-fm-pre"><code>${highlightYaml(yaml)}</code></pre>
</section>`;
  }

  // ── Block renderer ─────────────────────────────────────────────────────────

  const LANG_LABELS = {
    turtle: 'Turtle', turtle12: 'Turtle 1.2',
    shacl: 'SHACL', sparql: 'SPARQL', 'sparql-update': 'SPARQL Update',
    'json-ld': 'JSON-LD', trig: 'TriG',
    manifest: 'Manifest', 'transformer-library': 'Transformer Library',
    'processor-registry': 'Processor Registry',
    prompt: 'Prompt', yaml: 'YAML', json: 'JSON',
    javascript: 'JavaScript', js: 'JavaScript',
    python: 'Python', bash: 'Bash', sh: 'Shell',
  };

  function langLabel(lang) {
    return LANG_LABELS[(lang || '').toLowerCase()] || lang || 'code';
  }

  function renderBlock(seg) {
    const { label, meta, directives, content } = seg;
    const id   = meta['id']    || '';
    const lbl  = meta['label'] || '';
    const mode = directives['mode'] || '';

    const isHidden   = mode === 'hidden';
    const isRef      = mode === 'reference';
    const isExecuted = mode === 'executed';

    const blockClasses = [`${NS}-block`];
    if (isHidden)   blockClasses.push(`${NS}-block--hidden`);
    if (isRef)      blockClasses.push(`${NS}-block--reference`);
    if (isExecuted) blockClasses.push(`${NS}-block--executed`);

    const authority = directives['authority'] || '';
    const endpoint  = directives['endpoint']  || '';
    const cache     = directives['cache']     || '';

    const modeBadge = mode
      ? `<span class="${NS}-badge ${NS}-badge--${esc(mode)}">${esc(mode)}</span>`
      : '';

    const execMeta = (endpoint || cache)
      ? `<span class="${NS}-block-exec-meta">${
          endpoint ? `endpoint: <code>${esc(endpoint)}</code>` : ''
        }${cache ? ` · cache: ${esc(cache)}` : ''}</span>`
      : '';

    // Executed run-affordance button (only when endpoint is declared)
    const execBtn = (isExecuted && endpoint)
      ? `<button class="${NS}-exec-btn" title="Endpoint: ${esc(endpoint)}" aria-label="Executed block">
           <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
             <circle cx="5.5" cy="5.5" r="5" stroke="currentColor" stroke-width="1.2"/>
             <path d="M4 3.5l4 2-4 2V3.5Z" fill="currentColor"/>
           </svg>
         </button>`
      : '';

    const authorityBadge = authority
      ? `<span class="${NS}-badge ${NS}-badge--authority" title="Asserting authority">${esc(authority)}</span>`
      : '';

    // Copy button — always in block header; text extracted from rendered <code>
    const copyBtn = `<button class="${NS}-copy-btn" title="Copy block content" aria-label="Copy">
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <rect x="4.5" y="4.5" width="7.5" height="7.5" rx="1.25" stroke="currentColor" stroke-width="1.3"/>
        <path d="M3 8.5H2A1.5 1.5 0 0 1 .5 7V2A1.5 1.5 0 0 1 2 .5h5A1.5 1.5 0 0 1 8.5 2v1"
              stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
      </svg>
    </button>`;

    // ── Hidden block: inline styles are belt-and-suspenders ───────────────
    // CSS class alone can be unreliable in content script injection context.
    const hiddenPlaceholder = isHidden ? `
<div class="${NS}-hidden-ph" aria-hidden="true" style="display:flex">
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M1.5 7C1.5 7 3.5 3 7 3s5.5 4 5.5 4-2 4-5.5 4S1.5 7 1.5 7Z" stroke="currentColor" stroke-width="1.4"/>
    <circle cx="7" cy="7" r="1.75" stroke="currentColor" stroke-width="1.4"/>
    <path d="M2 2l10 10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
  </svg>
  <span>Hidden block${id ? ` · <code>${esc(id)}</code>` : ''} · <kbd>H</kbd> to reveal</span>
</div>` : '';

    const bodyStyle = isHidden ? ' style="display:none"' : '';

    const codeHtml = highlightCode(content, label);

    return `
<div class="${blockClasses.join(' ')}" ${id ? `id="${NS}-block-${esc(id)}"` : ''} data-block-id="${esc(id)}" data-mode="${esc(mode)}">
  <div class="${NS}-block-hd">
    ${execBtn}<span class="${NS}-block-lang">${esc(langLabel(label))}</span>
    ${lbl ? `<span class="${NS}-block-lbl">${esc(lbl)}</span>` : ''}
    ${id  ? `<span class="${NS}-block-id">#${esc(id)}</span>`  : ''}
    <span class="${NS}-block-badges">${modeBadge}${authorityBadge}</span>
    ${execMeta}
    ${copyBtn}
  </div>
  ${hiddenPlaceholder}
  <div class="${NS}-block-body"${bodyStyle}>
    <pre class="${NS}-code ${NS}-code--${esc(label || 'text')}"><code>${codeHtml}</code></pre>
  </div>
</div>`;
  }

  // ── Outline builder ───────────────────────────────────────────────────────
  // Walks segments in document order and extracts:
  //   • ATX headings from prose sections (level 1–4; h5/h6 omitted as too fine)
  //   • Every fenced data block (with label, id, mode)
  // Returns a flat array used to render the sidebar and drive scroll tracking.

  function headingId(text) {
    return text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
  }

  function buildOutlineItems(segments) {
    const items = [];

    for (const seg of segments) {
      if (seg.type === 'prose') {
        for (const line of seg.content.split('\n')) {
          const m = /^(#{1,4})\s+(.+)$/.exec(line);
          if (!m) continue;
          const level = m[1].length;
          // Strip inline markup from the heading text for display
          const text = m[2].replace(/\*\*([^*]+)\*\*/g, '$1')
                           .replace(/\*([^*]+)\*/g,     '$1')
                           .replace(/`([^`]+)`/g,       '$1')
                           .trim();
          items.push({ kind: 'heading', level, text, id: headingId(text) });
        }
      } else {
        const blockId    = seg.meta['id']    || '';
        const blockLabel = seg.meta['label'] || '';
        const mode       = seg.directives['mode'] || '';
        items.push({
          kind: 'block',
          label: seg.label,
          blockId,
          blockLabel,
          mode,
          anchorId: blockId ? `${NS}-block-${blockId}` : '',
        });
      }
    }
    return items;
  }

  // ── Sidebar renderer ───────────────────────────────────────────────────────

  function renderSidebar(items) {
    if (!items.length) return '';

    const rows = items.map(item => {
      if (item.kind === 'heading') {
        const indent = (item.level - 1) * 10; // 0 / 10 / 20 / 30 px
        return `<a class="${NS}-ol-h ${NS}-ol-h--${item.level}"
                   href="#${esc(item.id)}"
                   data-ol-target="${esc(item.id)}"
                   style="padding-left:${12 + indent}px"
                   title="${esc(item.text)}"
                >${esc(item.text)}</a>`;
      }

      // Block entry
      const modeCls   = item.mode ? ` ${NS}-ol-b--${esc(item.mode)}` : '';
      const modeTag   = item.mode === 'hidden'
        ? `<span class="${NS}-ol-mode">hidden</span>` : '';
      const idTag     = item.blockId
        ? `<span class="${NS}-ol-bid">#${esc(item.blockId)}</span>` : '';
      const labelSpan = (item.blockLabel && item.blockLabel !== item.blockId)
        ? `<span class="${NS}-ol-blbl">${esc(item.blockLabel)}</span>` : '';
      const href      = item.anchorId ? `#${esc(item.anchorId)}` : '#';

      return `<a class="${NS}-ol-b${modeCls}"
                 href="${href}"
                 data-ol-target="${esc(item.anchorId)}"
               ><span class="${NS}-ol-lang">${esc(langLabel(item.label))}</span
               >${idTag}${labelSpan}${modeTag}</a>`;
    }).join('\n');

    return `
<aside class="${NS}-sidebar" id="${NS}-sidebar" aria-label="Document outline">
  <div class="${NS}-sb-hd">
    <span class="${NS}-sb-title">
      <svg width="13" height="11" viewBox="0 0 13 11" fill="none" aria-hidden="true">
        <path d="M1 1.5h11M1 5.5h11M1 9.5h6.5"
              stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      </svg>
      Outline
    </span>
    <span class="${NS}-sb-count" id="${NS}-sb-count">${items.length}</span>
  </div>
  <div class="${NS}-sb-search-wrap">
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <circle cx="5" cy="5" r="3.5" stroke="currentColor" stroke-width="1.3"/>
      <path d="M8 8l2.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
    </svg>
    <input class="${NS}-sb-search" id="${NS}-sb-search"
           type="search" placeholder="Filter… (/)" aria-label="Filter outline items"
           autocomplete="off" spellcheck="false">
  </div>
  <nav class="${NS}-ol-list" id="${NS}-ol-list" aria-label="Document sections">
    ${rows}
  </nav>
  <div class="${NS}-sb-empty" id="${NS}-sb-empty" style="display:none">No matches</div>
</aside>`;
  }

  // ── Scroll tracking ────────────────────────────────────────────────────────
  // Uses a scroll listener rather than IntersectionObserver so the "active"
  // item always tracks the last section whose top edge passed the fold.

  function initScrollTracking() {
    const TOOLBAR_H = 56; // px clearance below toolbar

    // Build ordered list of { el, link } pairs
    const linkEls  = Array.from(document.querySelectorAll(`[data-ol-target]`));
    const anchors  = linkEls
      .map(link => {
        const id = link.dataset.olTarget;
        const el = id ? document.getElementById(id) : null;
        return el ? { el, link } : null;
      })
      .filter(Boolean);

    if (!anchors.length) return;

    let currentLink = null;

    function activate(link) {
      if (link === currentLink) return;
      if (currentLink) currentLink.classList.remove(`${NS}-ol--active`);
      currentLink = link;
      if (link) {
        link.classList.add(`${NS}-ol--active`);
        // Scroll the active item into view within the sidebar without
        // moving the main page.
        link.scrollIntoView({ block: 'nearest' });
      }
    }

    function update() {
      // Find the last anchor whose top edge is at or above the fold line
      let best = null;
      for (const { el, link } of anchors) {
        const top = el.getBoundingClientRect().top;
        if (top <= TOOLBAR_H + 8) best = link;
      }
      // Nothing above fold yet → activate first item
      activate(best || anchors[0].link);
    }

    window.addEventListener('scroll', update, { passive: true });
    // Also re-evaluate when hidden blocks are revealed (content reflows)
    document.body.addEventListener('click', () =>
      setTimeout(update, 50), { passive: true });
    update();
  }

  // ── Toolbar ────────────────────────────────────────────────────────────────

  function buildToolbar(title, docType, version) {
    const typeLabel = {
      'databook':            'DataBook',
      'transformer-library': 'Transformer Library',
      'processor-registry':  'Processor Registry',
    }[docType] || 'DataBook';

    return `
<div class="${NS}-toolbar" id="${NS}-toolbar" role="toolbar" aria-label="DataBook viewer controls">
  <div class="${NS}-toolbar-brand">
    <svg class="${NS}-logo" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="2.5" y="1.5" width="13" height="17" rx="1.75" stroke="currentColor" stroke-width="1.5"/>
      <path d="M6 6h8M6 9.5h8M6 13h5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M15.5 5l2.5 2-2.5 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <span class="${NS}-type-badge">${esc(typeLabel)}</span>
    ${version ? `<span class="${NS}-version-badge">v${esc(version)}</span>` : ''}
  </div>

  <div class="${NS}-toolbar-title" title="${esc(title)}">${esc(title)}</div>

  <div class="${NS}-toolbar-controls">
    <button class="${NS}-btn" id="${NS}-btn-outline" title="Toggle outline (O)" aria-pressed="true">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path d="M1 2.5h12M1 6.5h12M1 10.5h7"
              stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
      Outline
    </button>
    <button class="${NS}-btn" id="${NS}-btn-fm" title="Toggle frontmatter (F)" aria-pressed="true">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <rect x=".75" y=".75" width="12.5" height="12.5" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
        <path d="M3.5 4.5h7M3.5 7h5" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/>
      </svg>
      Frontmatter
    </button>
    <button class="${NS}-btn" id="${NS}-btn-hidden" title="Toggle hidden blocks (H)" aria-pressed="false">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path d="M1.5 7C1.5 7 3.5 3 7 3s5.5 4 5.5 4-2 4-5.5 4S1.5 7 1.5 7Z" stroke="currentColor" stroke-width="1.5"/>
        <circle cx="7" cy="7" r="1.75" stroke="currentColor" stroke-width="1.5"/>
        <path d="M2 2l10 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
      Hidden
    </button>
  </div>
</div>`;
  }

  // ── Page assembly ──────────────────────────────────────────────────────────

  function buildPage(raw) {
    const { yaml, body } = extractFrontmatter(raw);
    const title   = yamlScalar(yaml, 'title') || 'Untitled DataBook';
    const docType = yamlScalar(yaml, 'type')  || 'databook';
    const version = yamlScalar(yaml, 'version');
    const docId   = yamlScalar(yaml, 'id');

    const segments    = parseBody(body);
    const outlineItems = buildOutlineItems(segments);

    const parts = [buildToolbar(title, docType, version)];

    // ── Layout wrapper: sidebar left, main content right ──────────────────
    parts.push(`<div class="${NS}-layout" id="${NS}-layout">`);
    parts.push(renderSidebar(outlineItems));

    parts.push(`<main class="${NS}-main" id="${NS}-main"><div class="${NS}-doc">`);
    if (docId) parts.push(`<div class="${NS}-doc-id" title="Document IRI">${esc(docId)}</div>`);
    parts.push(renderFrontmatterCard(yaml));

    for (const seg of segments) {
      if (seg.type === 'prose') {
        const html = renderMarkdown(seg.content);
        if (html.trim()) parts.push(`<div class="${NS}-prose">${html}</div>`);
      } else {
        parts.push(renderBlock(seg));
      }
    }

    parts.push('</div></main>');
    parts.push('</div>'); // close layout
    return parts.join('\n');
  }

  // ── Toggle logic ───────────────────────────────────────────────────────────

  function initToggles() {
    const body       = document.body;
    const btnFm      = document.getElementById(`${NS}-btn-fm`);
    const btnHidden  = document.getElementById(`${NS}-btn-hidden`);
    const btnOutline = document.getElementById(`${NS}-btn-outline`);
    if (!btnFm || !btnHidden) return;

    let showFm      = localStorage.getItem(`${NS}:showFm`)      !== 'false';
    let showHidden  = localStorage.getItem(`${NS}:showHidden`)  === 'true';
    let showOutline = localStorage.getItem(`${NS}:showOutline`) !== 'false';

    function applyFm() {
      body.classList.toggle(`${NS}-fm-hidden`, !showFm);
      btnFm.setAttribute('aria-pressed', String(showFm));
      btnFm.classList.toggle(`${NS}-btn--on`, showFm);
      localStorage.setItem(`${NS}:showFm`, String(showFm));
    }

    function applyHidden() {
      // Drive visibility explicitly via inline styles — more reliable than
      // CSS class alone in content script injection contexts.
      document.querySelectorAll(`.${NS}-block--hidden .${NS}-block-body`).forEach(el => {
        el.style.display = showHidden ? 'block' : 'none';
        el.style.opacity = showHidden ? '0.55'  : '';
      });
      document.querySelectorAll(`.${NS}-block--hidden .${NS}-hidden-ph`).forEach(el => {
        el.style.display = showHidden ? 'none' : 'flex';
      });
      btnHidden.setAttribute('aria-pressed', String(showHidden));
      btnHidden.classList.toggle(`${NS}-btn--on`, showHidden);
      localStorage.setItem(`${NS}:showHidden`, String(showHidden));
    }

    function applyOutline() {
      body.classList.toggle(`${NS}-outline-hidden`, !showOutline);
      if (btnOutline) {
        btnOutline.setAttribute('aria-pressed', String(showOutline));
        btnOutline.classList.toggle(`${NS}-btn--on`, showOutline);
      }
      localStorage.setItem(`${NS}:showOutline`, String(showOutline));
    }

    btnFm.addEventListener('click',     () => { showFm      = !showFm;      applyFm();      });
    btnHidden.addEventListener('click', () => { showHidden  = !showHidden;  applyHidden();  });
    if (btnOutline) {
      btnOutline.addEventListener('click', () => { showOutline = !showOutline; applyOutline(); });
    }

    document.addEventListener('keydown', e => {
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'f' || e.key === 'F') { showFm      = !showFm;      applyFm();      }
      if (e.key === 'h' || e.key === 'H') { showHidden  = !showHidden;  applyHidden();  }
      if (e.key === 'o' || e.key === 'O') { showOutline = !showOutline; applyOutline(); }
      if (e.key === '/') {
        e.preventDefault();
        const s = document.getElementById(`${NS}-sb-search`);
        if (s) { s.focus(); s.select(); }
      }
    });

    applyFm();
    applyHidden();
    applyOutline();
  }

  // ── Block interactions ─────────────────────────────────────────────────────
  // Wired after DOM insertion — copy buttons and any future per-block UI.

  function initBlockInteractions() {
    document.querySelectorAll(`.${NS}-copy-btn`).forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        e.preventDefault();
        const blockEl = btn.closest(`.${NS}-block`);
        const codeEl  = blockEl && blockEl.querySelector('code');
        if (!codeEl) return;
        // innerText gives plain text from highlighted HTML
        const text = codeEl.innerText;
        try {
          await navigator.clipboard.writeText(text);
          btn.classList.add(`${NS}-copy-btn--done`);
          btn.setAttribute('title', 'Copied!');
          btn.querySelector('svg').outerHTML = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M2 7l3.5 3.5L11 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>`;
          setTimeout(() => {
            btn.classList.remove(`${NS}-copy-btn--done`);
            btn.setAttribute('title', 'Copy block content');
            btn.querySelector('svg').outerHTML = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <rect x="4.5" y="4.5" width="7.5" height="7.5" rx="1.25" stroke="currentColor" stroke-width="1.3"/>
              <path d="M3 8.5H2A1.5 1.5 0 0 1 .5 7V2A1.5 1.5 0 0 1 2 .5h5A1.5 1.5 0 0 1 8.5 2v1"
                    stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            </svg>`;
          }, 2000);
        } catch {
          // Clipboard API blocked — fall back to selection
          const range = document.createRange();
          range.selectNode(codeEl);
          window.getSelection().removeAllRanges();
          window.getSelection().addRange(range);
        }
      });
    });
  }

  // ── Sidebar search / filter ────────────────────────────────────────────────

  function initSidebarSearch() {
    const input   = document.getElementById(`${NS}-sb-search`);
    const counter = document.getElementById(`${NS}-sb-count`);
    const empty   = document.getElementById(`${NS}-sb-empty`);
    if (!input) return;

    const total = document.querySelectorAll(`[data-ol-target]`).length;

    input.addEventListener('input', () => {
      const q = input.value.toLowerCase().trim();
      const items = document.querySelectorAll(`[data-ol-target]`);
      let visible = 0;

      items.forEach(item => {
        const text = item.textContent.toLowerCase();
        const show = !q || text.includes(q);
        item.style.display = show ? '' : 'none';
        if (show) visible++;
      });

      if (counter) counter.textContent = q ? `${visible}/${total}` : total;
      if (empty)   empty.style.display  = (q && visible === 0) ? 'block' : 'none';
    });

    input.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        input.value = '';
        input.dispatchEvent(new Event('input'));
        input.blur();
      }
    });
  }

  // ── Message listener (popup) ───────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
    if (msg.action === 'ping') {
      const yaml = extractFrontmatter(document._databookRaw || '').yaml;
      respond({
        isDataBook: true,
        title:   yamlScalar(yaml, 'title'),
        docType: yamlScalar(yaml, 'type'),
        version: yamlScalar(yaml, 'version'),
      });
    }
    return true;
  });

  // ── Main ───────────────────────────────────────────────────────────────────

  const raw = getRawText();
  if (!raw || !isDataBook(raw)) return;

  document._databookRaw = raw;

  const { yaml } = extractFrontmatter(raw);
  const pageTitle = yamlScalar(yaml, 'title') || 'DataBook Viewer';
  document.head.innerHTML = `
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${esc(pageTitle)}</title>
  `;

  document.body.innerHTML = buildPage(raw);
  document.body.className = `${NS}-body`;
  initToggles();
  initScrollTracking();
  initBlockInteractions();
  initSidebarSearch();

})();
