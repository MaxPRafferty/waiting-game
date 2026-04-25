const COPY = {
  winner: [
    'A contestant has completed their obligation.',
    'The line adjusts. The contest notes this departure.',
    'Another box has been checked. The record is updated.',
    'A participant has fulfilled their civic duty to the queue.',
    'The broadcast confirms: one fewer box remains.',
  ],
  departure: [
    'A contestant has left the line. The contest is indifferent.',
    'Someone has departed. Their place is forfeit.',
    'The line has lost a participant. No comment.',
    'A box has been vacated. The queue adjusts without sentiment.',
    'One fewer contestant. The broadcast continues.',
  ],
  eligible: [
    'It is your turn. The contest awaits your decision.',
    'Your box is now available. Proceed when ready.',
    'The line has reached you. Check your box to complete.',
    'All prior obligations have been met. You may now act.',
    'The queue recognizes your eligibility.',
  ],
};

const sessionHistory = new Map();

export function getCopy(eventType) {
  const phrases = COPY[eventType];
  if (!phrases) return '';

  if (!sessionHistory.has(eventType)) {
    sessionHistory.set(eventType, -1);
  }

  const lastIndex = sessionHistory.get(eventType);
  let nextIndex;
  do {
    nextIndex = Math.floor(Math.random() * phrases.length);
  } while (nextIndex === lastIndex && phrases.length > 1);

  sessionHistory.set(eventType, nextIndex);
  return phrases[nextIndex];
}
