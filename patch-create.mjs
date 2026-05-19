/**
 * patch-create.mjs
 * One-shot patch for commands/create.js: moves the <!-- databook:id --> annotation
 * from inside the fenced block to before the fence opener (canonical v1.2+ placement).
 *
 * Usage:
 *   node patch-create.mjs [path/to/commands/create.js]
 *
 * Defaults to: commands/create.js  (relative to cwd)
 * Writes the patched file to the same path and prints a diff summary.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const targetPath = resolve(process.argv[2] ?? 'commands/create.js');

// ── Read source ────────────────────────────────────────────────────────────────
let src;
try {
  src = readFileSync(targetPath, 'utf8');
} catch (e) {
  console.error(`error: cannot read ${targetPath}: ${e.message}`);
  process.exit(1);
}

// ── Define old and new function bodies ────────────────────────────────────────
//
// OLD: annotation is the second line INSIDE the fence
//
const OLD_RENDER_BLOCK = `function renderBlock(block) {
  const lines = [
    \`\\\`\\\`\\\`\${block.label}\`,
    \`<!-- databook:id: \${block.blockId} -->\`,
    block.content,
    '\`\`\`',
  ];
  return lines.join('\\n');
}`;

//
// NEW: annotation is BEFORE the fence opener; any legacy inline annotations
// are stripped from the content payload (handles re-wrapping of old DataBooks).
//
const NEW_RENDER_BLOCK = `function renderBlock(block) {
  // Strip any inline <!-- databook:... --> annotations from the content payload.
  // These may be present when re-wrapping blocks extracted from older (v1.1)
  // DataBooks that used the inside-fence annotation placement.
  const RE_INLINE_META = /^<!--\\s*databook:[\\w-]+:.*?-->\\s*$/;
  const cleanContent = block.content
    .split('\\n')
    .filter(l => !RE_INLINE_META.test(l))
    .join('\\n');

  // Pre-fence annotation (canonical v1.2+ placement):
  // <!-- databook:id: block-id --> appears immediately before the opening fence,
  // with no blank line between the annotation and the fence.
  const lines = [
    \`<!-- databook:id: \${block.blockId} -->\`,
    \`\\\`\\\`\\\`\${block.label}\`,
    cleanContent,
    '\`\`\`',
  ];
  return lines.join('\\n');
}`;

// ── Apply patch ────────────────────────────────────────────────────────────────
if (!src.includes(OLD_RENDER_BLOCK)) {
  // Try a whitespace-tolerant search so the script still works if the source
  // has slightly different indentation/line endings.
  const OLD_SIG  = 'function renderBlock(block)';
  const sigIdx   = src.indexOf(OLD_SIG);
  if (sigIdx < 0) {
    console.error('error: renderBlock function not found in source. Has it already been patched?');
    process.exit(1);
  }

  // Find the closing brace by counting braces from the opening {
  const openBrace = src.indexOf('{', sigIdx);
  let depth = 0, i = openBrace;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) break; }
  }

  const oldBody = src.slice(sigIdx, i + 1);
  const patched = src.replace(oldBody, NEW_RENDER_BLOCK);

  if (patched === src) {
    console.error('error: replacement had no effect — check source manually.');
    process.exit(1);
  }

  writeFileSync(targetPath, patched, 'utf8');
  console.log(`patched: ${targetPath}`);
  console.log(`  replaced renderBlock (brace-matched, ${oldBody.length} chars → ${NEW_RENDER_BLOCK.length} chars)`);

} else {
  // Exact match — straightforward replacement
  const patched = src.replace(OLD_RENDER_BLOCK, NEW_RENDER_BLOCK);
  writeFileSync(targetPath, patched, 'utf8');
  console.log(`patched: ${targetPath}`);
  console.log(`  replaced renderBlock (exact match)`);
}

console.log('\nWhat changed:');
console.log('  BEFORE:  ```${label}  →  <!-- databook:id --> inside fence');
console.log('  AFTER:   <!-- databook:id --> before fence  →  ```${label}');
console.log('\nBackward compat: inline <!-- databook:... --> lines in block.content');
console.log('  are now stripped, so re-wrapped v1.1 DataBooks emit clean output.');
