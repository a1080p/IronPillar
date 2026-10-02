// A short list of slurs and explicit words that can't appear in a name or
// username. It's a first filter, not the whole system: people can report
// anything that gets through, and reports reach the developer by email.
// Keep in step with functions/src/moderation.ts on the server.
const BLOCKED_TERMS = [
  'fuck', 'shit', 'cunt', 'bitch', 'whore', 'slut', 'dick', 'cock', 'pussy', 'porn', 'sex',
  'nigger', 'nigga', 'faggot', 'fag', 'retard', 'kike', 'spic', 'chink', 'tranny', 'nazi',
  'hitler', 'rape', 'rapist', 'pedo', 'molest',
];

// Lowercased with common character swaps undone, so "f.u_c k" or "sh1t" match.
function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[0@]/g, 'o')
    .replace(/[1!|]/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/[5$]/g, 's')
    .replace(/7/g, 't')
    .replace(/[^a-z]/g, '');
}

export function containsBlockedTerm(text: string) {
  const flat = normalize(text);
  return BLOCKED_TERMS.some((term) => flat.includes(term));
}
