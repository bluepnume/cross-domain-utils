import {
    assertSameDomain, closeWindow, findChildFrameByName, findFrameByName, getAllChildFrames,
    getAllFramesInWindow, getAllWindows, getAncestor, getAncestors, getDistanceFromTop,
    getDomain, getFrameByName, getFrameForWindow, getFrames, getNextOpener,
    getNthParent, getNthParentFromTop, getOpener, getParent, getParents,
    getTop, getUltimateTop, getWindowType, isAncestor, isBlankDomain,
    isFrameWindowClosed, isFullpage, isIframe, isOpener, isParent,
    isPopup, isSameDomain, isSameTopWindow, isTop, isWindow,
    isWindowClosed, onCloseWindow, submitForm, WINDOW_TYPE
} from '../src';

// The test page is served on `localhost`; the same server answers at the
// IPv6 loopback literal, which the browser treats as a second origin.
const otherOrigin = location.hostname === 'localhost'
    ? `http://[::1]:${ location.port }`
    : `http://localhost:${ location.port }`;

const frames : Array<HTMLIFrameElement> = [];
const popups : Array<Window> = [];

type CreateFrameOptions = {
    readonly src ?: string,
    readonly name ?: string,
};

const createFrame = async ({ src = 'about:blank', name } : CreateFrameOptions = {}) : Promise<HTMLIFrameElement> => {
    const frame = document.createElement('iframe');

    if (name) {
        frame.name = name;
    }

    const loaded = new Promise<void>(resolve => {
        frame.addEventListener('load', () => resolve(), { once: true });
    });

    frame.src = src;
    document.body.append(frame);
    frames.push(frame);
    await loaded;

    return frame;
};

// A named child frame that the test expects to exist.
const named = (win : Window, name : string) : Window => {
    const frame = getFrameByName(win, name);

    if (!frame) {
        throw new Error(`No frame named ${ name }`);
    }

    return frame;
};

const contentWindow = (frame : HTMLIFrameElement) : Window => {
    if (!frame.contentWindow) {
        throw new Error('Frame has no window');
    }

    return frame.contentWindow;
};

const openPopup = (url : string) : Window => {
    const popup = window.open(url, `popup_${ crypto.randomUUID() }`, 'width=300,height=300');

    if (!popup) {
        throw new Error('Popup was blocked');
    }

    popups.push(popup);

    return popup;
};

const childPage = `${ location.origin }/test/pages/child.html`;
const nestedPage = `${ location.origin }/test/pages/nested.html`;
const foreignChildPage = `${ otherOrigin }/test/pages/child.html`;

afterEach(() => {
    for (const frame of frames.splice(0)) {
        frame.remove();
    }

    for (const popup of popups.splice(0)) {
        popup.close();
    }
});

describe('parents and tops', () => {
    it('finds the parent and top of a frame, and nothing above a top', async () => {
        const frame = await createFrame({ src: childPage });
        const child = contentWindow(frame);

        expect(getParent(child)).toBe(window);
        expect(getTop(child)).toBe(window.top);
        expect(isTop(child)).toBe(false);
        expect(getParent(window.top ?? window)).toBeUndefined();
        expect(isTop(window.top ?? window)).toBe(true);
    });

    it('walks every parent of a nested frame', async () => {
        const frame = await createFrame({ src: nestedPage });
        const outer = contentWindow(frame);
        const inner = named(outer, 'inner');

        expect(getParents(inner)).toEqual([ outer, ...getParents(outer) ]);
        expect(getParents(outer)[0]).toBe(window);
        expect(getDistanceFromTop(inner)).toBe(getDistanceFromTop(outer) + 1);
        expect(getNthParent(inner)).toBe(outer);
        expect(getNthParent(inner, 2)).toBe(window);
        expect(getNthParent(inner, 99)).toBeUndefined();
        expect(getNthParentFromTop(inner, 0)).toBe(window.top);
    });

    it('reads parent and top across origins', async () => {
        const frame = await createFrame({ src: foreignChildPage });
        const child = contentWindow(frame);

        expect(getParent(child)).toBe(window);
        expect(getTop(child)).toBe(window.top);
        expect(isSameTopWindow(child, window)).toBe(true);
    });

    it('treats a frame whose window is gone as having no parent', async () => {
        const frame = await createFrame({ src: childPage });
        const child = contentWindow(frame);

        frame.remove();

        expect(isWindowClosed(child)).toBe(true);
        expect(isFrameWindowClosed(frame)).toBe(true);
    });
});

describe('frames', () => {
    it('lists direct and nested child frames', async () => {
        const first = await createFrame({ src: childPage, name: 'first' });
        const nested = await createFrame({ src: nestedPage, name: 'nested' });
        const inner = named(contentWindow(nested), 'inner');

        expect(getFrames(window)).toEqual([ contentWindow(first), contentWindow(nested) ]);
        expect(getAllChildFrames(window)).toEqual([ contentWindow(first), contentWindow(nested), inner ]);
        expect(getAllFramesInWindow(contentWindow(first))).toContain(window);
        expect(getAllFramesInWindow(contentWindow(first))).toContain(inner);
        expect(getAllWindows(inner)).toEqual(getAllFramesInWindow(inner));
        expect(getFrames(contentWindow(first))).toEqual([]);
    });

    it('finds frames by name, directly, in children, and from the top', async () => {
        const nested = await createFrame({ src: nestedPage, name: 'outer' });
        const outer = contentWindow(nested);
        const inner = named(outer, 'inner');

        expect(getFrameByName(window, 'outer')).toBe(outer);
        expect(getFrameByName(window, 'inner')).toBeUndefined();
        expect(findChildFrameByName(window, 'inner')).toBe(inner);
        expect(findFrameByName(inner, 'outer')).toBe(outer);
        expect(findFrameByName(window, 'nope')).toBeUndefined();
    });

    it('finds a cross-origin frame by name through the named lookup', async () => {
        const frame = await createFrame({ src: foreignChildPage, name: 'foreign' });

        expect(getFrameByName(window, 'foreign')).toBe(contentWindow(frame));
        expect(isSameDomain(contentWindow(frame))).toBe(false);
    });

    it('relates parents, children and ancestors', async () => {
        const frame = await createFrame({ src: childPage });
        const child = contentWindow(frame);

        expect(isParent(window, child)).toBe(true);
        expect(isParent(child, window)).toBe(false);
        expect(isAncestor(window, child)).toBe(true);
        expect(isAncestor(child, window)).toBe(false);
        expect(getAncestor(child)).toBe(window);
        expect(getAncestors(child)).toEqual([ window, ...getAncestors(window) ]);
        expect(isIframe(child)).toBe(true);
        expect(isPopup(child)).toBe(false);
        expect(isFullpage(child)).toBe(false);
        expect(getWindowType(child)).toBe(WINDOW_TYPE.IFRAME);
    });

    it('maps a window back to its iframe element, same origin or not', async () => {
        const same = await createFrame({ src: childPage });
        const foreign = await createFrame({ src: foreignChildPage });

        expect(getFrameForWindow(contentWindow(same))).toBe(same);
        expect(getFrameForWindow(contentWindow(foreign))).toBe(foreign);
        expect(getFrameForWindow(window.top ?? window)).toBeUndefined();
    });

    it('closes an iframe by removing it', async () => {
        const frame = await createFrame({ src: childPage });
        const child = contentWindow(frame);

        closeWindow(child);

        expect(frame.isConnected).toBe(false);
        expect(isWindowClosed(child)).toBe(true);
    });
});

describe('origins', () => {
    it('knows a same-origin frame, an about:blank frame and a cross-origin frame apart', async () => {
        const same = contentWindow(await createFrame({ src: childPage }));
        const blank = contentWindow(await createFrame());
        const foreign = contentWindow(await createFrame({ src: foreignChildPage }));

        expect(isSameDomain(window)).toBe(true);
        expect(isSameDomain(same)).toBe(true);
        expect(isSameDomain(blank)).toBe(true);
        expect(isSameDomain(foreign)).toBe(false);
        expect(getDomain(same)).toBe(location.origin);
        expect(getDomain(blank)).toBe(location.origin);
        expect(assertSameDomain(same)).toBe(same);
        expect(() => assertSameDomain(foreign)).toThrow('same domain');
    });
});

describe('popups', () => {
    it('knows its opener, its type and its ultimate top', () => {
        const popup = openPopup(childPage);

        expect(getOpener(popup)).toBe(window);
        expect(isOpener(window, popup)).toBe(true);
        expect(isPopup(popup)).toBe(true);
        expect(isIframe(popup)).toBe(false);
        expect(isFullpage(popup)).toBe(false);
        expect(getWindowType(popup)).toBe(WINDOW_TYPE.POPUP);
        expect(getAncestor(popup)).toBe(window);
        expect(getNextOpener(popup)).toBe(window);
        expect(getUltimateTop(popup)).toBe(window.top);
        expect(isSameTopWindow(popup, window)).toBe(false);
        expect(getAllWindows(popup)).toEqual([ ...getAllWindows(window), popup ]);
    });

    it('a frame with an opener set is still a frame', async () => {
        const frame = await createFrame({ src: childPage });
        const child = contentWindow(frame);

        child.opener = window;

        expect(getOpener(child)).toBeUndefined();
    });

    it('closes a popup and notices it closed', async () => {
        const popup = openPopup(childPage);

        const closedAt = new Promise<void>(resolve => {
            onCloseWindow({ win: popup, callback: resolve, delay: 10 });
        });

        expect(isWindowClosed(popup)).toBe(false);
        closeWindow(popup);
        await closedAt;
        expect(isWindowClosed(popup)).toBe(true);
        expect(popup.closed).toBe(true);
    });

    it('onCloseWindow gives up after maxtime, and can be cancelled', async () => {
        const popup = openPopup(childPage);
        let called = 0;

        const bump = () : void => {
            called += 1;
        };

        onCloseWindow({ win: popup, callback: bump, delay: 5, maxtime: 20 });

        const watcher = onCloseWindow({ win: popup, callback: bump, delay: 5 });

        watcher.cancel();

        await new Promise(resolve => {
            setTimeout(resolve, 60);
        });

        popup.close();

        await new Promise(resolve => {
            setTimeout(resolve, 30);
        });

        expect(called).toBe(0);
    });
});

describe('isWindow', () => {
    it('is true for windows of any origin and false for everything else', async () => {
        const same = contentWindow(await createFrame({ src: childPage }));
        const foreign = contentWindow(await createFrame({ src: foreignChildPage }));

        expect(isWindow(window)).toBe(true);
        expect(isWindow(same)).toBe(true);
        expect(isWindow(foreign)).toBe(true);
        expect(isWindow({})).toBe(false);
        expect(isWindow({ self: 1 })).toBe(false);
        expect(isWindow(null)).toBe(false);
        expect(isWindow('window')).toBe(false);
        expect(isWindow(() => undefined)).toBe(false);
    });

    it('says yes for an object that answers to self, and for one that throws on it', () => {
        const selfish : { self ?: unknown } = {};

        selfish.self = selfish;
        expect(isWindow(selfish)).toBe(true);

        const touchy = {};

        Object.defineProperty(touchy, 'self', {
            get: () => {
                throw new Error('SecurityError');
            }
        });

        expect(isWindow(touchy)).toBe(true);
    });
});

describe('submitForm', () => {
    it('navigates a named frame with a GET form', async () => {
        const frame = await createFrame({ src: childPage, name: 'target' });

        const navigated = new Promise<void>(resolve => {
            frame.addEventListener('load', () => resolve(), { once: true });
        });

        submitForm({ url: childPage, target: 'target', method: 'get', body: { hello: 'world', flag: true } });
        await navigated;

        expect(contentWindow(frame).location.search).toBe('?hello=world&flag=true');
        expect(document.querySelector('form')).toBeNull();
    });

    it('posts by default', () => {
        const inspect = function (this : HTMLFormElement) : void {
            expect(this.method).toBe('post');
            expect(this.target).toBe('somewhere');
            expect(this.action).toBe('https://example.com/pay');
            expect([ ...this.elements ].map(element => (element as HTMLInputElement).name)).toEqual([ 'amount' ]);
        };

        const submit = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(inspect);

        submitForm({ url: 'https://example.com/pay', target: 'somewhere', body: { amount: '10' } });

        expect(submit).toHaveBeenCalledOnce();
        submit.mockRestore();
    });
});

describe('a window that is gone', () => {
    // A closed window from another origin throws on every read; a fake that
    // throws the same way exercises those paths without a real one.
    const gone = () : Window => new Proxy({}, {
        get: () => {
            throw new Error('SecurityError: window is closed');
        }
    }) as Window;

    it('reads as closed, parentless, topless and frameless', () => {
        const win = gone();

        expect(isWindowClosed(win)).toBe(true);
        expect(getParent(win)).toBeUndefined();
        expect(getOpener(win)).toBeUndefined();
        expect(getTop(win)).toBeUndefined();
        expect(getFrames(win)).toEqual([]);
        expect(getFrameByName(win, 'anything')).toBeUndefined();
        expect(isSameDomain(win)).toBe(false);
        expect(isBlankDomain(win)).toBe(false);
        expect(() => getAllFramesInWindow(win)).toThrow('top window');
    });

    it('isSameDomain is false when the origin cannot be computed', () => {
        const unreadable = { location: { href: 'https://x', protocol: '' }, parent: null } as unknown as Window;

        expect(isSameDomain(unreadable)).toBe(false);
    });
});

describe('edges', () => {
    const fake = (shape : Record<string, unknown>) : Window => shape as unknown as Window;

    it('the current window is never closed, and a top-level window has no type', () => {
        expect(isWindowClosed(window)).toBe(false);
        expect(getWindowType(window.top ?? window)).toBeUndefined();
        expect(isFullpage(window.top ?? window)).toBe(true);
    });

    it('a connected frame is not closed', async () => {
        const frame = await createFrame({ src: childPage });

        expect(isFrameWindowClosed(frame)).toBe(false);
    });

    it('a window with no top falls back to itself', () => {
        const topless = fake({ top: null, parent: null, opener: null, length: 0, closed: false });

        expect(getTop(topless)).toBeUndefined();
        expect(getUltimateTop(topless)).toBe(topless);
        expect(getNextOpener(topless)).toBeUndefined();
        expect(findFrameByName(topless, 'x')).toBeUndefined();
        expect(isSameTopWindow(topless, topless)).toBe(true);
        expect(isSameTopWindow(topless, window)).toBe(false);
    });

    it('skips a frame slot that has emptied', () => {
        expect(getFrames(fake({ length: 2, 0: window }))).toEqual([ window ]);
    });

    it('includes a frame inside a shadow root when walking from it', async () => {
        const host = document.createElement('div');
        const shadow = host.attachShadow({ mode: 'open' });
        const frame = document.createElement('iframe');

        document.body.append(host);

        const loaded = new Promise<void>(resolve => {
            frame.addEventListener('load', () => resolve(), { once: true });
        });

        frame.src = childPage;
        shadow.append(frame);
        await loaded;

        try {
            const all = getAllFramesInWindow(contentWindow(frame));

            expect(all).toContain(contentWindow(frame));
            expect(all).toContain(window.top ?? window);
        } finally {
            host.remove();
        }
    });
});
