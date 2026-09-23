export interface CardNavigationOptions {
  message?: string;
  stateChanged?: boolean;
}

export function pushCardResponse(
  card: GoogleAppsScript.Card_Service.Card,
): GoogleAppsScript.Card_Service.ActionResponse {
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(card))
    .build();
}

export function updateCardResponse(
  card: GoogleAppsScript.Card_Service.Card,
  options?: CardNavigationOptions,
): GoogleAppsScript.Card_Service.ActionResponse {
  return finishResponse(
    CardService.newActionResponseBuilder().setNavigation(
      CardService.newNavigation().updateCard(card),
    ),
    options,
  );
}

export function popCardResponse(
  options?: CardNavigationOptions,
): GoogleAppsScript.Card_Service.ActionResponse {
  return finishResponse(
    CardService.newActionResponseBuilder().setNavigation(
      CardService.newNavigation().popCard(),
    ),
    options,
  );
}

export function popAndUpdateCardResponse(
  card: GoogleAppsScript.Card_Service.Card,
  options?: CardNavigationOptions,
): GoogleAppsScript.Card_Service.ActionResponse {
  return finishResponse(
    CardService.newActionResponseBuilder().setNavigation(
      CardService.newNavigation().popCard().updateCard(card),
    ),
    options,
  );
}

function finishResponse(
  builder: GoogleAppsScript.Card_Service.ActionResponseBuilder,
  options?: CardNavigationOptions,
): GoogleAppsScript.Card_Service.ActionResponse {
  if (options?.message !== undefined) {
    builder.setNotification(
      CardService.newNotification().setText(options.message),
    );
  }
  if (options?.stateChanged !== undefined) {
    builder.setStateChanged(options.stateChanged);
  }
  return builder.build();
}

export interface NotificationResponseOptions {
  stateChanged?: boolean;
}

export function buildNotificationResponse(
  message: string,
  options: NotificationResponseOptions = {},
): GoogleAppsScript.Card_Service.ActionResponse {
  const builder = CardService.newActionResponseBuilder().setNotification(
    CardService.newNotification().setText(message),
  );
  if (options.stateChanged !== undefined) {
    builder.setStateChanged(options.stateChanged);
  }
  return builder.build();
}
