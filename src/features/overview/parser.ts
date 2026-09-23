import type { OverviewProjectItem } from './model';
import { parseDriveFolderId } from './character-scripts';

const PROJECT_HEADER_PATTERN = /^(\d+)\s+(.+)$/;
const VOICE_ACTOR_LINE_PATTERN = /^(.+?)\s*-\s*(.+)$/;
const YOUTUBE_URL_PATTERN =
  /^https?:\/\/(?:www\.)?(?:youtube\.com\/|youtu\.be\/)/i;

function isYoutubeUrl(line: string): boolean {
  return YOUTUBE_URL_PATTERN.test(line.trim());
}

function isDriveFolderUrl(line: string): boolean {
  return parseDriveFolderId(line) !== undefined;
}

function parseVoiceActorLine(line: string): {
  voiceActor: string;
  characters: string[];
} {
  const match = line.trim().match(VOICE_ACTOR_LINE_PATTERN);
  if (!match) {
    throw new Error(`Invalid voice actor line: ${line}`);
  }

  const voiceActor = match[1].trim();
  const characters = match[2]
    .split(',')
    .map((character) => character.trim())
    .filter((character) => character.length > 0);

  if (characters.length === 0) {
    throw new Error(`No characters found in voice actor line: ${line}`);
  }

  return { voiceActor, characters };
}

function parseOverviewBlock(block: string): OverviewProjectItem {
  const lines = block
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    throw new Error('Overview block is empty.');
  }

  const headerMatch = lines[0].match(PROJECT_HEADER_PATTERN);
  if (!headerMatch) {
    throw new Error(`Invalid project header: ${lines[0]}`);
  }

  const item: OverviewProjectItem = {
    number: Number(headerMatch[1]),
    title: headerMatch[2].trim(),
    voiceActor: '',
    characters: [],
  };

  const urlLines: string[] = [];
  let voiceActorLine: string | undefined;

  for (let index = 1; index < lines.length; index++) {
    const line = lines[index];
    if (isYoutubeUrl(line) || isDriveFolderUrl(line)) {
      urlLines.push(line.trim());
      continue;
    }

    if (voiceActorLine !== undefined) {
      throw new Error(`Unexpected line in project ${item.number}: ${line}`);
    }

    voiceActorLine = line;
  }

  if (!voiceActorLine) {
    throw new Error(`Missing voice actor line for project ${item.number}.`);
  }

  const voiceActor = parseVoiceActorLine(voiceActorLine);
  item.voiceActor = voiceActor.voiceActor;
  item.characters = voiceActor.characters;

  const youtubeUrls = urlLines.filter(isYoutubeUrl);
  const driveUrls = urlLines.filter(isDriveFolderUrl);

  if (youtubeUrls.length > 1) {
    throw new Error(`Project ${item.number} has more than one YouTube URL.`);
  }

  if (youtubeUrls.length === 1) {
    item.youtubeUrl = youtubeUrls[0];
  }

  if (driveUrls.length > 2) {
    throw new Error(
      `Project ${item.number} has more than two Drive folder URLs.`,
    );
  }

  if (driveUrls.length >= 1) {
    item.characterScriptsFolderUrl = driveUrls[0];
  }

  if (driveUrls.length >= 2) {
    item.postProductionFolderUrl = driveUrls[1];
  }

  return item;
}

export function parseOverviewText(text: string): OverviewProjectItem[] {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (normalized.length === 0) {
    return [];
  }

  const lines = normalized.split('\n');
  const blocks: string[] = [];
  let currentBlock: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0) {
      continue;
    }

    if (PROJECT_HEADER_PATTERN.test(line) && currentBlock.length > 0) {
      blocks.push(currentBlock.join('\n'));
      currentBlock = [line];
      continue;
    }

    currentBlock.push(line);
  }

  if (currentBlock.length > 0) {
    blocks.push(currentBlock.join('\n'));
  }

  return blocks.map(parseOverviewBlock);
}
