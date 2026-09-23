import type { ErrorCardView } from '../../../ui/models';
import type { CharacterScriptsLoadReason } from '../character-scripts-workspace';

const LOAD_MESSAGES: Record<CharacterScriptsLoadReason, string> = {
  'invalid-folder-id':
    'The project folder id is missing or invalid. Select the folder in Drive and try again.',
  'folder-trashed':
    'This project folder is in the trash. Restore it in Drive and try again.',
  'not-numbered-project':
    'The selected folder is not a numbered project folder. Select a folder named with a project number and title.',
  'invalid-project-title':
    'The project folder title cannot be turned into a character-script header.',
  'folder-too-large':
    'This folder has more than 100 character scripts. Move extra files out of the folder root and try again.',
};

const DEFAULT_LOAD_MESSAGE =
  'Could not load the selected project folder. Reload the card and try again.';

export function toCharacterScriptsErrorView(
  reason: CharacterScriptsLoadReason | 'load-failed' | 'missing-folder-id',
): ErrorCardView {
  const message =
    reason === 'load-failed' || reason === 'missing-folder-id'
      ? reason === 'missing-folder-id'
        ? LOAD_MESSAGES['invalid-folder-id']
        : DEFAULT_LOAD_MESSAGE
      : LOAD_MESSAGES[reason];
  return {
    title: 'Character scripts',
    subtitle: 'Could not load',
    message,
    recovery:
      'In Drive, select another file, then the numbered project folder to retry.',
  };
}
