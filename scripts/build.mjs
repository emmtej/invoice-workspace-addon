import { copyFile, mkdir, readFile, rm } from 'node:fs/promises';
import { build } from 'esbuild';

const publicCallbacks = [
  'onHomepage',
  'onDriveHomepage',
  'onDriveItemsSelected',
  'onDocsHomepage',
  'onOpenInvoiceProjectScripts',
  'onChangeInvoicePage',
  'onChangeInvoiceProjectScriptsPage',
  'onApplyInvoiceProjectScriptResults',
  'onOpenInvoiceScriptLineAudit',
  'onChangeInvoiceScriptLineAuditPage',
  'onFinalizeInvoice',
  'onOpenInvoiceSettings',
  'onSaveInvoiceSettings',
  'onRequestDocsFileScope',
  'onMissingProjectLink',
  'onInitializeProject',
  'onCreateInvoice',
  'onOpenOverviewSettings',
  'onToggleAdditionalCharacterCheck',
  'onOpenAdditionalCharactersEditor',
  'onSaveAdditionalCharacters',
  'onOpenClearProjectScriptPropertiesConfirmation',
  'onCancelClearProjectScriptProperties',
  'onClearProjectScriptProperties',
  'onWriteCharacterScriptTitleHeaders',
];

function collectManifestCallbacks(value) {
  if (Array.isArray(value)) {
    return value.flatMap(collectManifestCallbacks);
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  return Object.entries(value).flatMap(([key, child]) =>
    key === 'runFunction' && typeof child === 'string'
      ? [child]
      : collectManifestCallbacks(child),
  );
}

const manifest = JSON.parse(await readFile('appsscript.json', 'utf8'));
const manifestCallbacks = collectManifestCallbacks(manifest.addOns);

for (const callback of manifestCallbacks) {
  if (!publicCallbacks.includes(callback)) {
    throw new Error(`Manifest callback is not public: ${callback}`);
  }
}

const callbackBridge = publicCallbacks
  .map(
    (callback) =>
      `function ${callback}(event) { return InvoiceWorkspace.${callback}(event); }`,
  )
  .join('\n');

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });

await build({
  entryPoints: ['src/entrypoints/index.ts'],
  outfile: 'dist/Code.js',
  bundle: true,
  charset: 'utf8',
  format: 'iife',
  globalName: 'InvoiceWorkspace',
  legalComments: 'none',
  platform: 'neutral',
  target: 'es2019',
  mainFields: ['module', 'main'], // needed so fast-xml-parser nested deps resolve under platform:neutral
  footer: { js: callbackBridge },
});

const bundleSource = await readFile('dist/Code.js', 'utf8');
const bundledApi = new Function(`${bundleSource}\nreturn InvoiceWorkspace;`)();
for (const callback of publicCallbacks) {
  if (typeof bundledApi[callback] !== 'function') {
    throw new Error(`Public callback is not exported: ${callback}`);
  }
}

await copyFile('appsscript.json', 'dist/appsscript.json');
