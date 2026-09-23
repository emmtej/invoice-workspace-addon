import { escapeCardHtml } from '../../../shared/ui/card-text';
import {
  buildCardHeader,
  buildEmptyStateSection,
  buildFixedFooter,
} from '../../../ui/chrome';
import type { ProjectDashboardView } from './project-dashboard-view';

export function buildProjectDashboardCard(
  view: ProjectDashboardView,
): GoogleAppsScript.Card_Service.Card {
  const builder = CardService.newCardBuilder().setHeader(
    buildCardHeader(view.title, view.subtitle),
  );
  if (view.empty) {
    builder.addSection(buildEmptyStateSection(view.empty));
  }
  if (view.rows.length > 0) {
    const section = CardService.newCardSection();
    for (const row of view.rows) {
      const decorated = CardService.newDecoratedText()
        .setTopLabel(row.topLabel)
        .setText(escapeCardHtml(row.text))
        .setWrapText(true);
      if (row.bottomLabel) {
        decorated.setBottomLabel(escapeCardHtml(row.bottomLabel));
      }
      section.addWidget(decorated);
    }
    builder.addSection(section);
  }
  if (view.footer) {
    builder.setFixedFooter(buildFixedFooter(view.footer));
  }
  return builder.build();
}
