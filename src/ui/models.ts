export interface CardActionSpec {
  functionName: string;
  parameters: Record<string, string>;
  spinner?: boolean;
}

interface OpenLinkSpec {
  url: string;
  openAs?: 'full-size';
}

export interface SettingsCogView {
  label: string;
  altText: string;
  iconUrl: string;
  action: CardActionSpec;
}

export interface PagingView {
  label: string;
  previous?: CardActionSpec;
  next?: CardActionSpec;
}

type ActionOrLinkTarget =
  | { action: CardActionSpec }
  | { openLink: OpenLinkSpec };

export type PrimaryFooterButtonView = {
  label: string;
  altText?: string;
  style: 'filled' | 'danger';
} & ActionOrLinkTarget;

export type SecondaryFooterButtonView = {
  label: string;
  altText?: string;
} & ActionOrLinkTarget;

export type FooterButtonView =
  | PrimaryFooterButtonView
  | SecondaryFooterButtonView;

export interface FooterView {
  primary: PrimaryFooterButtonView;
  secondary?: SecondaryFooterButtonView;
}

export interface ErrorCardView {
  title: string;
  subtitle: string;
  message: string;
  recovery: string;
  footer?: FooterView;
}
