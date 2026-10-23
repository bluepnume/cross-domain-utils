// A window reference, which may belong to another origin: every browser hands
// those out as the same `Window` type, with most property reads throwing.
// The two names are kept from earlier versions so that code reads as before.
export type CrossDomainWindowType = Window;

export type SameDomainWindowType = Window;

// An origin, a pattern for one, a list of either, or `*`.
export type DomainMatcher = string | RegExp | ReadonlyArray<string | RegExp>;
