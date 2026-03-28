import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const DUCK_PHRASES = [
  "Have you tried turning it off and on again?",
  "Did you check the semicolons?",
  "Is the variable actually defined?",
  "What if you console.log it?",
  "I am just a duck. Quack.",
  "Are you sure you installed the dependencies?",
  "It's probably a caching issue.",
  "Blame the compiler. It's always the compiler.",
  "Have you considered a career in carpentry instead?",
  "Read the documentation. Just do it."
];

export default function RubberDuck() {
  const [isOpen, setIsOpen] = useState(false);
  const [phrase, setPhrase] = useState("");

  const handleClick = () => {
    setPhrase(DUCK_PHRASES[Math.floor(Math.random() * DUCK_PHRASES.length)]);
    setIsOpen(true);
    const audio = new Audio("https://www.myinstants.com/media/sounds/duck-quack.mp3");
    audio.play().catch(() => {});
    setTimeout(() => setIsOpen(false), 5000);
  };

  return (
    <div className="absolute bottom-6 left-6 z-50 flex items-end gap-3 pointer-events-none">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="bg-[#18181b] border border-yellow-500/30 text-yellow-100 text-xs px-4 py-2 rounded-2xl rounded-bl-none shadow-[0_4px_20px_rgba(234,179,8,0.15)] max-w-[200px] pointer-events-auto"
          >
            <p className="font-medium">{phrase}</p>
          </motion.div>
        )}
      </AnimatePresence>
      <button
        onClick={handleClick}
        className="pointer-events-auto text-4xl hover:scale-110 active:scale-95 transition-transform filter drop-shadow-[0_0_10px_rgba(234,179,8,0.2)]"
        title="Talk to the Rubber Duck"
      >
        🦆
      </button>
    </div>
  );
}
