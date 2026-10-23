import type { WindowType } from './constants';

import { WINDOW_TYPE } from './constants';

import { assertSameDomain, isSameDomain } from './domain';

// Reads that the browser allows on a cross-origin window never throw; the
// ones below that are wrapped can throw for a window that has been closed
// and torn down, which is treated as "no such window".

export const getParent = (win : Window = window) : Window | undefined => {
    try {
        return win.parent === win
            ? undefined
            : win.parent;
    } catch {
        return undefined;
    }
};

// The window that opened this one, unless it is an iframe (an iframe can
// have `opener` set, and that is never what is wanted).
export const getOpener = (win : Window = window) : Window | undefined => {
    if (getParent(win)) {
        return undefined;
    }

    try {
        return (win.opener as Window | null) ?? undefined;
    } catch {
        return undefined;
    }
};

export const getParents = (win : Window) : ReadonlyArray<Window> => {
    const result : Array<Window> = [];

    for (let parent = getParent(win); parent; parent = getParent(parent)) {
        result.push(parent);
    }

    return result;
};

// The direct child frames of a window. `length` and indexed access are
// readable across origins; an element inside a shadow root is still a frame
// of its window.
export const getFrames = (win : Window) : ReadonlyArray<Window> => {
    try {
        return Array.from({ length: win.length }, (_, index) => index).flatMap(index => {
            const frame = win[index];

            return frame
                ? [ frame ]
                : [];
        });
    } catch {
        return [];
    }
};

export const getAllChildFrames = (win : Window) : ReadonlyArray<Window> =>
    getFrames(win).flatMap(frame => [ frame, ...getAllChildFrames(frame) ]);

export const getTop = (win : Window = window) : Window | undefined => {
    try {
        return (win.top) ?? undefined;
    } catch {
        return undefined;
    }
};

export const isTop = (win : Window) : boolean => win === getTop(win);

export const getNextOpener = (win : Window = window) : Window | undefined => getOpener(getTop(win) ?? win);

// Follow openers to the top window that nothing opened.
export const getUltimateTop = (win : Window = window) : Window => {
    const opener = getNextOpener(win);

    return opener
        ? getUltimateTop(opener)
        : (getTop(win) ?? win);
};

// Every frame in the window's tree, top included. A window in a shadow
// root is not reachable from its top's `frames`, so it is added along
// with its own children when missing.
export const getAllFramesInWindow = (win : Window) : ReadonlyArray<Window> => {
    const top = getTop(win);

    if (!top) {
        throw new Error('Can not determine top window');
    }

    const result = [ ...getAllChildFrames(top), top ];

    return result.includes(win)
        ? result
        : [ ...result, win, ...getAllChildFrames(win) ];
};

// Every frame in this window's tree and in every window up the opener chain.
export const getAllWindows = (win : Window = window) : ReadonlyArray<Window> => {
    const frames = getAllFramesInWindow(win);
    const opener = getNextOpener(win);

    return opener
        ? [ ...getAllWindows(opener), ...frames ]
        : frames;
};

export const isFrameWindowClosed = (frame : HTMLIFrameElement) : boolean => !frame.contentWindow || !frame.isConnected;

// Closed, or removed from the page (a detached iframe's window reads as
// closed in every current browser).
export const isWindowClosed = (win : Window) : boolean => {
    if (win === window) {
        return false;
    }

    try {
        return win.closed;
    } catch {
        return true;
    }
};

// The child frame of `win` with this name, if there is one. A same-origin
// child's `name` is read directly; otherwise the window's own named lookup
// is used, which the browser allows across origins for child frames.
export const getFrameByName = (win : Window, name : string) : Window | undefined => {
    const frames = getFrames(win);

    for (const frame of frames) {
        if (isSameDomain(frame) && frame.name === name) {
            return frame;
        }
    }

    try {
        const named = win.frames[name as unknown as number];

        if (named && frames.includes(named)) {
            return named;
        }
    } catch {
        // A closed window; nothing to find.
    }

    return undefined;
};

export const findChildFrameByName = (win : Window, name : string) : Window | undefined => {
    const direct = getFrameByName(win, name);

    if (direct) {
        return direct;
    }

    for (const frame of getFrames(win)) {
        const found = findChildFrameByName(frame, name);

        if (found) {
            return found;
        }
    }

    return undefined;
};

export const findFrameByName = (win : Window, name : string) : Window | undefined =>
    getFrameByName(win, name) ?? findChildFrameByName(getTop(win) ?? win, name);

export const isParent = (win : Window, frame : Window) : boolean => getParent(frame) === win;

export const isOpener = (parent : Window, child : Window) : boolean => parent === getOpener(child);

// The opener for a popup, the parent for a frame.
export const getAncestor = (win : Window = window) : Window | undefined => getOpener(win) ?? getParent(win);

export const getAncestors = (win : Window) : ReadonlyArray<Window> => {
    const results : Array<Window> = [];
    let ancestor = getAncestor(win);

    while (ancestor) {
        results.push(ancestor);
        ancestor = getAncestor(ancestor);
    }

    return results;
};

export const isAncestor = (parent : Window, child : Window) : boolean => getAncestor(child) === parent;

export const isPopup = (win : Window = window) : boolean => Boolean(getOpener(win));

export const isIframe = (win : Window = window) : boolean => Boolean(getParent(win));

export const isFullpage = (win : Window = window) : boolean => !isIframe(win) && !isPopup(win);

export const getWindowType = (win : Window = window) : WindowType | undefined => {
    if (isIframe(win)) {
        return WINDOW_TYPE.IFRAME;
    }

    return isPopup(win)
        ? WINDOW_TYPE.POPUP
        : undefined;
};

export const getDistanceFromTop = (win : Window = window) : number => getParents(win).length;

export const getNthParent = (win : Window, n = 1) : Window | undefined => {
    let parent : Window | undefined = win;

    for (let i = 0; i < n; i += 1) {
        parent = parent && getParent(parent);
    }

    return parent;
};

export const getNthParentFromTop = (win : Window, n = 1) : Window | undefined =>
    getNthParent(win, getDistanceFromTop(win) - n);

export const isSameTopWindow = (first : Window, second : Window) : boolean =>
    (getTop(first) ?? first) === (getTop(second) ?? second);

export type Cancelable = {
    readonly cancel : () => void,
};

export type OnCloseWindowOptions = {
    readonly win : Window,
    readonly callback : () => void,
    // Milliseconds between checks.
    readonly delay ?: number,
    // Stop checking after this many milliseconds.
    readonly maxtime ?: number,
};

// Poll until the window closes, then call back; `maxtime` bounds the wait.
export const onCloseWindow = (
    { win, callback, delay = 1000, maxtime = Infinity } : OnCloseWindowOptions
) : Cancelable => {
    let remaining = maxtime;
    let timer : ReturnType<typeof setTimeout> | undefined;

    const check = () : void => {
        if (isWindowClosed(win)) {
            callback();

            return;
        }

        if (remaining <= 0) {
            return;
        }

        remaining -= delay;
        timer = setTimeout(check, delay);
    };

    check();

    return {
        cancel: () => {
            clearTimeout(timer);
        }
    };
};

// Is this a window, from any origin? A cross-origin window answers to
// `self === itself`, which the browser allows reading.
export const isWindow = (value : unknown) : value is Window => {
    if (value === null || (typeof value !== 'object' && typeof value !== 'function')) {
        return false;
    }

    if (value === window || (typeof Window !== 'undefined' && value instanceof Window)) {
        return true;
    }

    try {
        if (Object.prototype.toString.call(value) === '[object Window]') {
            return true;
        }

        const candidate = value as { self ?: unknown };

        if (candidate.self === value) {
            return true;
        }
    } catch {
        // Reading `self` threw: only a cross-origin window does that.
        return true;
    }

    // A closed cross-origin window answers `self` with null, but still
    // refuses to read anything outside the cross-origin allowlist.
    try {
        Reflect.get(value, 'crossDomainUtilsProbe');
    } catch {
        return true;
    }

    return false;
};

// The iframe element whose window this is, when it is in this document.
export const getFrameForWindow = (win : Window) : HTMLIFrameElement | undefined => {
    return isSameDomain(win)
        ? (assertSameDomain(win).frameElement as HTMLIFrameElement | null) ?? undefined
        : [ ...document.querySelectorAll(`iframe`) ].find(frame => frame.contentWindow === win);
};

// Remove an iframe from the page, or close a popup.
export const closeWindow = (win : Window) : void => {
    if (isIframe(win)) {
        const frame = getFrameForWindow(win);

        if (frame) {
            frame.remove();

            return;
        }
    }

    try {
        win.close();
    } catch {
        // Already gone.
    }
};
