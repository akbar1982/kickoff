// Objectionable-language filter for everything people write: chat, group and game names, descriptions.
// Words are matched on their own (WORDS) or anywhere inside a word (STEMS, for languages that inflect).
// Admins still review reports; this catches the obvious cases before anyone has to see them.

const WORDS = new Set([
  // en
  "cunt", "cunts", "bitch", "bitches", "asshole", "assholes", "whore", "whores", "slut", "sluts", "bastard", "retard", "retards",
  // ru
  "сука", "суки", "сучка", "блядь", "бля", "мразь", "шлюха", "гандон",
  // es
  "puta", "putas", "puto", "coño", "joder", "maricón", "maricon",
]);

const STEMS = [
  // en
  "fuck", "shit", "nigger", "nigga", "faggot", "motherf",
  // ru
  "хуй", "хуё", "хуе", "пизд", "ебат", "ебан", "ебал", "ёбан", "ебуч", "пидор", "пидар", "мудак", "мудил", "долбоёб", "долбоеб",
  // uz
  "jalab", "qanjiq", "dalbayob", "dalbayop",
  // es
  "mierda", "pendej", "cabrón", "cabron", "chinga",
  // ko
  "씨발", "시발", "병신", "좆", "개새끼",
  // zh
  "傻逼", "操你", "他妈的", "妈逼", "贱人",
];

// innocent words that contain a stem
const ALLOWED = new Set(["shitake", "shiitake"]);

const TOKEN = /[^\s.,!?;:"'“”«»()[\]{}<>/\\|_~-]+/g;

const isBad = (word: string) => {
  const w = word.toLowerCase();
  return !ALLOWED.has(w) && (WORDS.has(w) || STEMS.some((s) => w.includes(s)));
};

/** True if the text contains objectionable language. */
export const isObjectionable = (text: string | null | undefined) => !!text && (text.match(TOKEN) ?? []).some(isBad);

/** The text with objectionable words masked, e.g. "f***". */
export const clean = (text: string) => text.replace(TOKEN, (w) => isBad(w) ? w[0] + "*".repeat(Math.max(w.length - 1, 3)) : w);
