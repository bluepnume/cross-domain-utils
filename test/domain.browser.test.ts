import {
    getDomain, getDomainFromUrl, getProtocol, isAboutProtocol, isBlankDomain,
    isBrowser, isCurrentDomain, isFileProtocol, matchDomain, stringifyDomainPattern
} from '../src';

// A window-shaped object is enough for the origin helpers, which only read
// `location` and `parent`.
const fakeWindow = (location : Partial<Location>, extra : Record<string, unknown> = {}) : Window => {
    const win = { location, ...extra } as unknown as Window;

    return Object.assign(win, { parent: extra.parent ?? win });
};

describe('getDomain', () => {
    it('is protocol and host', () => {
        expect(getDomain(fakeWindow({ protocol: 'https:', host: 'foo.com:8087' }))).toBe('https://foo.com:8087');
    });

    it('is file:// for a file, with no host', () => {
        expect(getDomain(fakeWindow({ protocol: 'file:' }))).toBe('file://');
    });

    it('is the parent origin for an about: frame whose parent can be read', () => {
        const parent = fakeWindow({ protocol: 'https:', host: 'parent.com', href: 'https://parent.com/' });

        expect(getDomain(fakeWindow({ protocol: `about:`, href: `about:blank` }, { parent }))).toBe(`https://parent.com`);
    });

    it('is about:// for an about: frame with no readable parent', () => {
        const parent = fakeWindow({ protocol: 'https:', host: 'parent.com' });

        Object.defineProperty(parent.location, 'href', {
            get: () => {
                throw new Error('cross-origin');
            }
        });

        expect(getDomain(fakeWindow({ protocol: 'about:' }, { parent }))).toBe('about://');
        expect(getDomain(fakeWindow({ protocol: 'about:' }))).toBe('about://');
    });

    it('throws when protocol or host are missing', () => {
        expect(() => getDomain(fakeWindow({ host: 'foo.com' }))).toThrow('protocol');
        expect(() => getDomain(fakeWindow({ protocol: 'https:' }))).toThrow('host');
    });

    it('defaults to the current window', () => {
        expect(getDomain()).toBe(`${ window.location.protocol }//${ window.location.host }`);
    });
});

describe('protocols', () => {
    it('reads the protocol and recognises file and about', () => {
        expect(getProtocol(fakeWindow({ protocol: 'https:' }))).toBe('https:');
        expect(isFileProtocol(fakeWindow({ protocol: 'file:' }))).toBe(true);
        expect(isFileProtocol(fakeWindow({ protocol: 'https:' }))).toBe(false);
        expect(isAboutProtocol(fakeWindow({ protocol: 'about:' }))).toBe(true);
        expect(isAboutProtocol()).toBe(false);
    });
});

describe('isBlankDomain', () => {
    it('is true for no href or about:blank, false otherwise, false when unreadable', () => {
        expect(isBlankDomain(fakeWindow({ href: '' }))).toBe(true);
        expect(isBlankDomain(fakeWindow({ href: 'about:blank' }))).toBe(true);
        expect(isBlankDomain(fakeWindow({ href: 'https://foo.com/' }))).toBe(false);

        const unreadable = fakeWindow({});

        Object.defineProperty(unreadable.location, 'href', {
            get: () => {
                throw new Error('cross-origin');
            }
        });

        expect(isBlankDomain(unreadable)).toBe(false);
    });
});

describe('matchDomain', () => {
    it('matches strings exactly, or anything with the wildcard', () => {
        expect(matchDomain('https://foo.com', 'https://foo.com')).toBe(true);
        expect(matchDomain('https://foo.com', 'https://bar.com')).toBe(false);
        expect(matchDomain('*', 'https://anything.com')).toBe(true);
        expect(matchDomain('https://foo.com', /foo/u)).toBe(false);
        expect(matchDomain('https://foo.com', [ 'https://foo.com' ])).toBe(false);
    });

    it('tests a RegExp against an origin, and compares two RegExps by source', () => {
        expect(matchDomain(/^https:\/\/.*\.foo\.com$/u, 'https://www.foo.com')).toBe(true);
        expect(matchDomain(/^https:\/\/.*\.foo\.com$/u, 'https://foo.com')).toBe(false);
        expect(matchDomain(/foo/u, /foo/u)).toBe(true);
        expect(matchDomain(/foo/u, /bar/u)).toBe(false);
        expect(matchDomain(/foo/u, [ 'https://foo.com' ])).toBe(false);
    });

    it('matches a list when any entry matches, and compares two lists for equality', () => {
        expect(matchDomain([ 'https://a.com', /b\.com/u ], 'https://b.com')).toBe(true);
        expect(matchDomain([ 'https://a.com', /b\.com/u ], 'https://c.com')).toBe(false);
        expect(matchDomain([ 'https://a.com' ], [ 'https://a.com' ])).toBe(true);
        expect(matchDomain([ 'https://a.com' ], [ 'https://b.com' ])).toBe(false);
        expect(matchDomain([ 'https://a.com' ], /a/u)).toBe(false);
    });
});

describe('stringifyDomainPattern', () => {
    it('describes strings, RegExps and lists', () => {
        expect(stringifyDomainPattern('https://foo.com')).toBe('https://foo.com');
        expect(stringifyDomainPattern(/foo\.com/u)).toBe(String.raw`RegExp(/foo\.com/u)`);
        expect(stringifyDomainPattern([ 'https://foo.com', /bar/u ])).toBe('(https://foo.com | /bar/u)');
    });
});

describe('getDomainFromUrl', () => {
    it('takes the origin of an absolute http, https or file url', () => {
        expect(getDomainFromUrl('http://foo.com/some/path?x=1')).toBe('http://foo.com');
        expect(getDomainFromUrl('https://sub.foo.com:8080/a/b/c')).toBe('https://sub.foo.com:8080');
        expect(getDomainFromUrl('https://api.foo.com')).toBe('https://api.foo.com');
        expect(getDomainFromUrl('file:///Users/me/index.html')).toBe('file://');
    });

    it('is the current origin for a path', () => {
        expect(getDomainFromUrl('/some/path')).toBe(getDomain());
    });
});

describe('isBrowser and isCurrentDomain', () => {
    it('knows this is a browser, and what its origin is', () => {
        expect(isBrowser()).toBe(true);
        expect(isCurrentDomain(getDomain())).toBe(true);
        expect(isCurrentDomain('https://elsewhere.com')).toBe(false);
    });
});
