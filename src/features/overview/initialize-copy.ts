import {
  assembleCharacterRequirements,
  matchCharacterRequirements,
  type CharacterRequirement,
  type CharacterRequirementSource,
  type CharacterScriptMatchResult,
} from './character-scripts';
import {
  buildScriptCopyProperties,
  matchDestinationCharacterRequirements,
} from './destination-scripts';
import type { OverviewProjectItem } from './model';
import type {
  InitializationRunContext,
  ProjectInitializationDependencies,
} from './initialize-model';

function namesOf(entries: Array<{ displayName: string }>): string[] {
  return entries.map((entry) => entry.displayName);
}

function formatUnresolvedParts(parts: {
  destinationMissing: Array<{ displayName: string }>;
  destinationAmbiguous: Array<{ displayName: string }>;
  sourceMissing: Array<{ displayName: string }>;
  sourceAmbiguous: Array<{ displayName: string }>;
  failures: string[];
}): string {
  const messages: string[] = [];
  if (parts.destinationMissing.length) {
    messages.push(
      `Missing from Original Scripts: ${namesOf(parts.destinationMissing).join(', ')}`,
    );
  }
  if (parts.destinationAmbiguous.length) {
    messages.push(
      `Multiple matches in Original Scripts: ${namesOf(parts.destinationAmbiguous).join(', ')}`,
    );
  }
  if (parts.sourceMissing.length) {
    messages.push(`Missing source: ${namesOf(parts.sourceMissing).join(', ')}`);
  }
  if (parts.sourceAmbiguous.length) {
    messages.push(
      `Multiple source matches: ${namesOf(parts.sourceAmbiguous).join(', ')}`,
    );
  }
  if (parts.failures.length) {
    messages.push(`Retry: ${parts.failures.join(', ')}`);
  }
  return messages.join(' · ');
}

function splitBySource<T extends { source: CharacterRequirementSource }>(
  entries: readonly T[],
): { overview: T[]; manual: T[] } {
  return {
    overview: entries.filter((entry) => entry.source === 'overview'),
    manual: entries.filter((entry) => entry.source === 'manual'),
  };
}

function unresolvedDetail(
  sourceMatches: CharacterScriptMatchResult,
  destinationMatches: CharacterScriptMatchResult,
  failures: Array<{
    displayName: string;
    source: CharacterRequirementSource;
  }>,
): { required: string; optional: string; combined: string } {
  const destinationMissing = splitBySource(destinationMatches.missing);
  const destinationAmbiguous = splitBySource(destinationMatches.ambiguous);
  const missingDestinationKeys = new Set(
    destinationMatches.missing.map((entry) => entry.key),
  );
  const sourceMissing = splitBySource(
    sourceMatches.missing.filter((entry) =>
      missingDestinationKeys.has(entry.key),
    ),
  );
  const sourceAmbiguous = splitBySource(
    sourceMatches.ambiguous.filter((entry) =>
      missingDestinationKeys.has(entry.key),
    ),
  );
  const failed = splitBySource(failures);
  const required = formatUnresolvedParts({
    destinationMissing: destinationMissing.overview,
    destinationAmbiguous: destinationAmbiguous.overview,
    sourceMissing: sourceMissing.overview,
    sourceAmbiguous: sourceAmbiguous.overview,
    failures: namesOf(failed.overview),
  });
  const optional = formatUnresolvedParts({
    destinationMissing: destinationMissing.manual,
    destinationAmbiguous: destinationAmbiguous.manual,
    sourceMissing: sourceMissing.manual,
    sourceAmbiguous: sourceAmbiguous.manual,
    failures: namesOf(failed.manual),
  });
  return {
    required,
    optional,
    combined: [required, optional ? `Optional: ${optional}` : '']
      .filter(Boolean)
      .join(' · '),
  };
}

export interface InitializationCopyPlan {
  requirements: CharacterRequirement[];
  sourceMatches: CharacterScriptMatchResult;
  ready: CharacterScriptMatchResult['ready'];
}

export interface InitializationCopyResult {
  copiedThisRun: number;
  satisfiedCount: number;
  complete: boolean;
  unresolved: string;
  optional: string;
  manualCharactersFound: string[];
}

export function planInitializationCopies(
  item: OverviewProjectItem,
  sourceFolderId: string,
  dependencies: Pick<
    ProjectInitializationDependencies,
    'listSourceFiles' | 'getSettings'
  >,
): InitializationCopyPlan {
  const sourceFiles = dependencies.listSourceFiles(sourceFolderId);
  const settings = dependencies.getSettings();
  const requirements = assembleCharacterRequirements(
    item.characters,
    settings.enabled ? settings.characters : [],
  );
  const sourceMatches = matchCharacterRequirements(requirements, sourceFiles);
  const ready = [...sourceMatches.ready].sort((left, right) => {
    if (left.source === right.source) {
      return 0;
    }
    return left.source === 'overview' ? -1 : 1;
  });
  return { requirements, sourceMatches, ready };
}

export function executeInitializationCopies(
  context: InitializationRunContext,
  originalScriptsFolderId: string,
  plan: InitializationCopyPlan,
  dependencies: Pick<
    ProjectInitializationDependencies,
    'listSourceFiles' | 'copyDriveFile' | 'withLock'
  >,
): InitializationCopyResult {
  const { requirements, sourceMatches, ready } = plan;
  const failedKeys = new Set<string>();
  let copiedThisRun = 0;
  for (let index = 0; index < ready.length; index++) {
    const match = ready[index];
    if (!context.budget.canContinue()) {
      for (const remaining of ready.slice(index)) {
        failedKeys.add(remaining.key);
      }
      break;
    }
    try {
      const outcome = dependencies.withLock(() => {
        const destinationFiles = dependencies.listSourceFiles(
          originalScriptsFolderId,
        );
        const destinationMatch = matchDestinationCharacterRequirements(
          [{ character: match.displayName, source: match.source }],
          destinationFiles,
        );
        if (destinationMatch.ready.length === 1) {
          return 'satisfied' as const;
        }
        if (destinationMatch.ambiguous.length > 0) {
          return 'ambiguous' as const;
        }
        if (!match.file.canCopy) {
          return 'failed' as const;
        }
        dependencies.copyDriveFile(
          match.file,
          originalScriptsFolderId,
          buildScriptCopyProperties(match.key, match.file.id),
        );
        context.mutation.changed = true;
        return 'copied' as const;
      });
      if (outcome === 'copied') {
        copiedThisRun++;
      } else if (outcome === 'failed') {
        failedKeys.add(match.key);
      }
    } catch (_error) {
      failedKeys.add(match.key);
    }
  }

  const {
    satisfiedCount,
    complete,
    unresolved,
    optional,
    manualCharactersFound,
  } = dependencies.withLock(() => {
    const destinationFiles = dependencies.listSourceFiles(
      originalScriptsFolderId,
    );
    const destinationMatches = matchDestinationCharacterRequirements(
      requirements,
      destinationFiles,
    );
    const currentSatisfiedCount = destinationMatches.ready.filter(
      (match) => match.source === 'overview',
    ).length;
    const currentManualCharactersFound = destinationMatches.ready
      .filter((match) => match.source === 'manual')
      .map((match) => match.displayName);
    const missingDestinationKeys = new Set(
      destinationMatches.missing.map((entry) => entry.key),
    );
    const unsatisfiedFailures = sourceMatches.ready
      .filter(
        (match) =>
          failedKeys.has(match.key) && missingDestinationKeys.has(match.key),
      )
      .map((match) => ({
        displayName: match.displayName,
        source: match.source,
      }));
    const currentComplete =
      destinationMatches.overviewCount > 0 &&
      destinationMatches.missing.every(
        (entry) => entry.source !== 'overview',
      ) &&
      destinationMatches.ambiguous.every(
        (entry) => entry.source !== 'overview',
      );
    const detail = unresolvedDetail(
      sourceMatches,
      destinationMatches,
      unsatisfiedFailures,
    );
    return {
      satisfiedCount: currentSatisfiedCount,
      complete: currentComplete,
      unresolved: detail.combined,
      optional: detail.optional,
      manualCharactersFound: currentManualCharactersFound,
    };
  });
  return {
    copiedThisRun,
    satisfiedCount,
    complete,
    unresolved,
    optional,
    manualCharactersFound,
  };
}
