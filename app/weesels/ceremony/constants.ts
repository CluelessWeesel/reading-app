// A category's pre-flight pool can be any size, but only this many advance
// to the ballot -- confirm-category enforces this on the server too, this
// is just the single shared source of truth for the number.
export const MAX_NOMINEES = 4;
