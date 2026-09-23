# Invoice Workspace

Invoice Workspace helps voice actors organize scripts and prepare invoices in Google Drive and Google Docs.

Open the add-on in the sidebar, then select a project folder named like `579 Project name`, or open a document named `Overview` or `Invoice`.

## What it does

- Creates project folders from an `Overview` document and copies the relevant scripts from `Original Scripts`.
- Adds the project number and title to character scripts in Google Docs and Word (`.docx`) format, leaving `Original Scripts` untouched.
- Counts billable words in project scripts and writes the totals to an `Invoice` document.

This is an example internal tool, still under development. Changes to real files in Google Workspace and support for some script formats still need testing. Review the totals before using them to bill.

## Development

The add-on is written in TypeScript, with source code in `src/`. esbuild bundles it into `dist/Code.js` for Apps Script. The interface uses CardService, and `appsscript.json` defines the Drive and Docs triggers.

Use Node.js 22.17.0 or later:

```sh
npm install
npm run build
npm test
```

`npm test` checks types, builds the add-on, and runs the tests with Node's built-in test runner. The build also checks that manifest callbacks are included in the bundle.

## How it handles files

Folder setup, script parsing, and title-header writes check a 20-second budget between steps. If time runs out, the add-on reports what remains unfinished. A failed write can still leave a file partly updated.

Before applying word counts to an invoice, the add-on checks whether the scripts have changed since the preview. If they have, you need to generate a new preview. Invoice and overview writes also use per-user locks, though two different users can still write at the same time.

For Word files, the add-on checks the DOCX archive, edits the title header in its document XML, and uploads it back to Drive. Google Docs title headers are edited through DocumentApp. Character-script logs record counts and reason codes without file names or IDs.

## License

Copyright 2026 Emmanuel T. All rights reserved. The repository is public so it can be read. The code is not licensed for use or redistribution. See `LICENSE`.
