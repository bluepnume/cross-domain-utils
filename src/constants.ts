export const PROTOCOL = {
    FILE:  'file:',
    ABOUT: 'about:'
} as const;

export const WILDCARD = '*';

export const WINDOW_TYPE = {
    IFRAME: 'iframe',
    POPUP:  'popup'
} as const;

export type WindowType = typeof WINDOW_TYPE[keyof typeof WINDOW_TYPE];
