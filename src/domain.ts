import { PROTOCOL, WILDCARD } from './constants';

import type { DomainMatcher } from './types';

// Whether this side may read the window's location: true for the same
// origin, and for an `about:blank` frame that inherited it. A cross-origin
// window throws on the read.
export const canReadFromWindow = (win : Window) : boolean => {
    try {
        return typeof win.location.href === 'string';
    } catch {
        return false;
    }
};

export const getProtocol = (win : Window = window) : string => win.location.protocol;

export const isFileProtocol = (win : Window = window) : boolean => getProtocol(win) === PROTOCOL.FILE;

export const isAboutProtocol = (win : Window = window) : boolean => getProtocol(win) === PROTOCOL.ABOUT;

// The origin of a window this side can read: `https://host:port`, or
// `file://` for a file, or the parent's origin for an `about:` frame.
export const getDomain = (win : Window = window) : string => {
    const { location } = win;

    if (!location.protocol) {
        throw new Error('Can not read window protocol');
    }

    if (location.protocol === PROTOCOL.FILE) {
        return `${ PROTOCOL.FILE }//`;
    }

    if (location.protocol === PROTOCOL.ABOUT) {
        const parent = win.parent === win
            ? undefined
            : win.parent;

        return parent && canReadFromWindow(parent)
            ? getDomain(parent)
            : `${ PROTOCOL.ABOUT }//`;
    }

    if (!location.host) {
        throw new Error('Can not read window host');
    }

    return `${ location.protocol }//${ location.host }`;
};

export const isBlankDomain = (win : Window) : boolean => {
    try {
        return !win.location.href || win.location.href === 'about:blank';
    } catch {
        return false;
    }
};

// Same origin as this window, or an `about:blank` frame of it. Being able
// to read the location is the test: the browser enforces exactly this rule.
export const isSameDomain = (win : Window) : boolean => {
    if (win === window) {
        return true;
    }

    if (!canReadFromWindow(win)) {
        return false;
    }

    try {
        return isAboutProtocol(win) || getDomain(win) === getDomain(window);
    } catch {
        return false;
    }
};

export const assertSameDomain = (win : Window) : Window => {
    if (!isSameDomain(win)) {
        throw new Error('Expected window to be same domain');
    }

    return win;
};

const isRegExp = (value : unknown) : value is RegExp =>
    Object.prototype.toString.call(value) === '[object RegExp]';

// Does `origin` satisfy `pattern`? A string matches itself or `*`, a RegExp
// is tested against it, and a list matches if any entry does. Two patterns
// of the same shape compare for equality.
export const matchDomain = (pattern : DomainMatcher, origin : DomainMatcher) : boolean => {
    if (typeof pattern === 'string') {
        return typeof origin === 'string' && (pattern === WILDCARD || origin === pattern);
    }

    if (isRegExp(pattern)) {
        return isRegExp(origin)
            ? pattern.toString() === origin.toString()
            : typeof origin === `string` && pattern.test(origin);
    }

    return Array.isArray(origin)
        ? JSON.stringify(pattern) === JSON.stringify(origin)
        : pattern.some(subpattern => matchDomain(subpattern, origin));
};

export const stringifyDomainPattern = (pattern : DomainMatcher) : string => {
    if (Array.isArray(pattern)) {
        return `(${ pattern.join(' | ') })`;
    }

    return isRegExp(pattern)
        ? `RegExp(${ pattern.toString() })`
        : String(pattern);
};

// The origin of an absolute http(s) or file url; this window's origin for
// anything else, such as a path.
export const getDomainFromUrl = (url : string) : string => {
    return (/^(https?|file):\/\//u).test(url)
        ? url.split('/').slice(0, 3).join('/')
        : getDomain();
};

export const isBrowser = () : boolean => typeof window !== 'undefined';

export const isCurrentDomain = (domain : string) : boolean => isBrowser() && getDomain() === domain;
