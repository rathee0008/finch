/**
 * Bundles the built app into a single self-contained HTML fragment suitable
 * for publishing as a Claude Artifact.
 *
 * Artifacts are wrapped in their own <!doctype>/<head>/<body> at publish time
 * and a strict CSP blocks every external request, so the output here is page
 * *content* only, with the CSS and JS inlined rather than linked.
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const assetsDir = join(root, 'dist', 'assets');

const files = readdirSync(assetsDir);
const jsFile = files.find((f) => f.endsWith('.js'));
const cssFile = files.find((f) => f.endsWith('.css'));

if (!jsFile || !cssFile) {
  throw new Error(`Expected a built .js and .css in ${assetsDir}. Run "npm run build" first.`);
}

const js = readFileSync(join(assetsDir, jsFile), 'utf8');
const css = readFileSync(join(assetsDir, cssFile), 'utf8');

/**
 * A literal "</script" anywhere in the bundle would close the inline script
 * tag early and truncate the app, so neutralize it. The escaped form is
 * equivalent once the JS parser reads it back.
 */
const safeJs = js.replace(/<\/script/gi, '<\\/script');

// Same hazard for "</style" inside the stylesheet.
const safeCss = css.replace(/<\/style/gi, '<\\/style');

// The charset declaration must come first and stay inside the document's
// first 1024 bytes. Without it the category emoji and em-dashes decode as
// mojibake wherever the host doesn't already send charset=utf-8.
const html = `<meta charset="utf-8" />
<title>Finch</title>
<meta name="description" content="A local-first personal finance manager: budgets, cash-flow forecasting, debt payoff planning and automatic spending insights." />
<style>
${safeCss}
</style>
<div id="root"></div>
<script type="module">
${safeJs}
</script>
`;

mkdirSync(join(root, 'artifact'), { recursive: true });
const out = join(root, 'artifact', 'finch.html');
writeFileSync(out, html, 'utf8');

const mb = (Buffer.byteLength(html, 'utf8') / 1024 / 1024).toFixed(2);
console.log(`Wrote ${out}`);
console.log(`  css: ${(css.length / 1024).toFixed(1)} KB`);
console.log(`  js:  ${(js.length / 1024).toFixed(1)} KB`);
console.log(`  total: ${mb} MB (artifact limit is 16 MB)`);
