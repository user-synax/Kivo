export const TYPING_PROMPTS = [
  "The quick brown fox jumps over the lazy dog while the sun sets behind the mountains.",
  "Pack my box with five dozen liquor jugs and watch the sunset over the ocean.",
  "Coding is like writing poetry where every semicolon carries the weight of logic.",
  "In the middle of difficulty lies opportunity waiting to be discovered by those who persist.",
  "The greatest glory in living lies not in never falling but in rising every time we fall.",
  "Life is what happens when you are busy making other plans and dreaming of tomorrow.",
  "Success is not final failure is not fatal it is the courage to continue that counts.",
  "The only way to do great work is to love what you do and share it with others.",
  "A journey of a thousand miles begins with a single step toward the unknown.",
  "To be yourself in a world that is constantly trying to make you something else is the greatest accomplishment.",
  "The future belongs to those who believe in the beauty of their dreams and act on them.",
  "Innovation distinguishes between a leader and a follower in every field of work.",
  "Simplicity is the ultimate sophistication and the key to elegant design solutions.",
  "Stay hungry stay foolish and never stop exploring the boundaries of what is possible.",
  "Time is what we want most but what we use worst in our daily routines.",
  "The best way to predict the future is to invent it with your own hands.",
  "Friendship is born at that moment when one person says to another what you too I thought I was the only one.",
  "Happiness can be found even in the darkest of times if one only remembers to turn on the light.",
  "It does not matter how slowly you go as long as you do not stop moving forward.",
  "Everything you have ever wanted is on the other side of fear and doubt.",
  "The purpose of our lives is to be happy and to make others happy along the way.",
  "Turn your wounds into wisdom and your struggles into stories that inspire.",
  "Keep smiling because life is a beautiful thing and there is so much to smile about.",
  "The way to get started is to quit talking and begin doing what you love most.",
  "If you are working on something exciting that you really care about you do not have to be pushed.",
];

export function pickRandomPrompt() {
  return TYPING_PROMPTS[Math.floor(Math.random() * TYPING_PROMPTS.length)];
}
