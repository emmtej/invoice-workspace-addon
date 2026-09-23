export function collectGoogleDocTabs<T>(
  tabs: readonly T[],
  getChildTabs: (tab: T) => readonly T[],
): T[] {
  const collected: T[] = [];
  for (const tab of tabs) {
    collected.push(tab);
    collected.push(...collectGoogleDocTabs(getChildTabs(tab), getChildTabs));
  }
  return collected;
}
