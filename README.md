# cross-domain-utils

Window and origin helpers for code that talks across frames and popups.

```sh
npm install cross-domain-utils
```

```ts
import { getOpener, getParent, isSameDomain, isWindowClosed, matchDomain } from 'cross-domain-utils';

const ancestor = getOpener() ?? getParent();          // who put this window here
if (ancestor && !isWindowClosed(ancestor)) { ... }

isSameDomain(someFrame);                                // may I read it
matchDomain([ 'https://a.com', /\.b\.com$/u ], origin); // does this origin fit
```

ES modules, TypeScript types included, no dependencies, ES2019 syntax. For current browsers: nothing here exists to work around an old one.

## What's here

Every function takes a `Window`, from any origin, and never throws on one it can't look inside; reads the browser allows across origins (`parent`, `top`, `opener`, `closed`, `frames`, `length`, named child frames, `self`) are used directly, and the ones it doesn't (`location`, `name`, `document`) are behind `isSameDomain`.

**Where a window sits**

| Function | Gives |
| --- | --- |
| `getParent(win?)`, `getParents(win)` | The parent frame, or every ancestor frame, none for a top |
| `getOpener(win?)` | The window that opened a popup; never set for an iframe |
| `getAncestor(win?)`, `getAncestors(win)` | Opener for a popup, parent for a frame, and so on up |
| `getTop(win?)`, `isTop(win)` | The top of a frame tree |
| `getNextOpener(win?)`, `getUltimateTop(win?)` | Across popup chains: the top's opener, and the top nothing opened |
| `isIframe(win?)`, `isPopup(win?)`, `isFullpage(win?)`, `getWindowType(win?)` | What kind of window it is |
| `getDistanceFromTop(win?)`, `getNthParent(win, n?)`, `getNthParentFromTop(win, n?)` | Position in the frame tree |
| `isParent(win, frame)`, `isOpener(parent, child)`, `isAncestor(parent, child)`, `isSameTopWindow(a, b)` | Relationships |

**Frames**

| Function | Gives |
| --- | --- |
| `getFrames(win)`, `getAllChildFrames(win)` | Direct children, or the whole subtree |
| `getAllFramesInWindow(win)`, `getAllWindows(win?)` | Every frame in the tree, and every frame up the opener chain |
| `getFrameByName(win, name)`, `findChildFrameByName(win, name)`, `findFrameByName(win, name)` | By name: a direct child, anywhere below, anywhere in the tree |
| `getFrameForWindow(win)` | The `<iframe>` element for a window in this document |

**Lifetime**

| Function | Gives |
| --- | --- |
| `isWindowClosed(win)`, `isFrameWindowClosed(frame)` | Closed, or removed from the page |
| `onCloseWindow({ win, callback, delay?, maxtime? })` | Poll until it closes; returns `{ cancel }` |
| `closeWindow(win)` | Removes an iframe, closes a popup |

**Origins**

| Function | Gives |
| --- | --- |
| `getDomain(win?)` | `https://host:port`, `file://`, or a blank frame's inherited origin |
| `isSameDomain(win)`, `assertSameDomain(win)`, `canReadFromWindow(win)` | May this side read it |
| `matchDomain(pattern, origin)`, `stringifyDomainPattern(pattern)` | A `DomainMatcher` is a string, a RegExp, a list of either, or `*` |
| `getDomainFromUrl(url)`, `isCurrentDomain(domain)`, `isBrowser()` | Odds and ends |
| `getProtocol(win?)`, `isFileProtocol(win?)`, `isAboutProtocol(win?)`, `isBlankDomain(win)` | Protocol checks |

**Other**

| Function | Gives |
| --- | --- |
| `isWindow(value)` | Whether a value is a window, of any origin |
| `submitForm({ url, target, method?, body? })` | Navigate a named window by form submission, the only way to POST into one |

Constants: `WILDCARD`, `PROTOCOL`, `WINDOW_TYPE`. Types: `DomainMatcher`, `WindowType`, and `CrossDomainWindowType` / `SameDomainWindowType` as aliases of `Window` for code written against earlier versions.

## Changes in 4.0

Published as `cross-domain-utils` again (3.x lived under `@krakenjs`). ES modules and TypeScript only. Gone, because no supported browser needs them: the Internet Explorer error-message checks, user-agent sniffing (`getUserAgent`), the orphaned-iframe tracking (`linkFrameWindow`), the `mock://` domain machinery for tests (`isMockDomain`, `normalizeMockUrl`, `mockDomain`, `mockclosed`, `mockUserAgent`), the `window.constructor` and property-descriptor tricks, and the separate `getActualDomain` / `isActuallySameDomain` (the plain functions now do what those did). `isSameDomain` is now simply "can this side read the window's location", which is the rule browsers enforce. `getTop` and `isSameTopWindow` no longer search child frames as a fallback. `submitForm` moved here from belter. The test suite runs against real same-origin, cross-origin and nested frames and real popups.

## License

Apache-2.0
