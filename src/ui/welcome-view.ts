export type WelcomeHost = 'docs' | 'drive';

export interface WelcomeRowView {
  name: string;
  purpose: string;
}

export interface WelcomeView {
  title: string;
  instruction: string;
  rows: readonly WelcomeRowView[];
}

const TITLE = 'Invoice Workspace';

export function toWelcomeView(host: WelcomeHost): WelcomeView {
  return host === 'docs' ? docsWelcome() : driveWelcome();
}

function docsWelcome(): WelcomeView {
  return {
    title: TITLE,
    instruction:
      'Open a document named <b>Overview</b>. Invoice tools are in Drive.',
    rows: [overviewRow()],
  };
}

function driveWelcome(): WelcomeView {
  return {
    title: TITLE,
    instruction:
      'Select a numbered project folder, or a Google Doc named <b>Overview</b> or <b>Invoice</b>.',
    rows: [projectFolderRow(), overviewRow(), invoiceRow()],
  };
}

function projectFolderRow(): WelcomeRowView {
  return {
    name: 'Project folder',
    purpose: 'Write title headers on translated character scripts.',
  };
}

function overviewRow(): WelcomeRowView {
  return {
    name: 'Overview',
    purpose: 'Set up folders and create Invoice.',
  };
}

function invoiceRow(): WelcomeRowView {
  return {
    name: 'Invoice',
    purpose: 'Parse scripts and finalize billing.',
  };
}
