# 🎮 Games Plugin — Technical Specification

## Overview
A plugin system that integrates mini-games into VibeCodium for breaks, team bonding, and gamified coding challenges.

---

## 🎯 Game Categories

### Category 1: **Break-Time Arcade Games**
Quick 2-5 minute games for mental breaks.

#### Game 1: **Code Snake** 🐍
Classic Snake but the snake is made of syntax tokens.

**Implementation:**
```typescript
// client/src/plugins/games/CodeSnake.tsx
import { useEffect, useRef, useState } from 'react';

interface Position { x: number; y: number }
interface SnakeSegment extends Position { token: string }

export default function CodeSnake() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [snake, setSnake] = useState<SnakeSegment[]>([
    { x: 10, y: 10, token: 'const' }
  ]);
  const [food, setFood] = useState<Position & { token: string }>({
    x: 15, y: 15, token: 'function'
  });
  const [direction, setDirection] = useState<'UP' | 'DOWN' | 'LEFT' | 'RIGHT'>('RIGHT');
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  const TOKENS = ['const', 'let', 'var', 'function', 'class', 'return', 'if', 'for', 'while', 'async'];
  const GRID_SIZE = 20;
  const CELL_SIZE = 20;

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' && direction !== 'DOWN') setDirection('UP');
      if (e.key === 'ArrowDown' && direction !== 'UP') setDirection('DOWN');
      if (e.key === 'ArrowLeft' && direction !== 'RIGHT') setDirection('LEFT');
      if (e.key === 'ArrowRight' && direction !== 'LEFT') setDirection('RIGHT');
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [direction]);

  useEffect(() => {
    if (gameOver) return;

    const gameLoop = setInterval(() => {
      setSnake(prev => {
        const head = prev[0];
        let newHead: SnakeSegment;

        switch (direction) {
          case 'UP':    newHead = { x: head.x, y: head.y - 1, token: head.token }; break;
          case 'DOWN':  newHead = { x: head.x, y: head.y + 1, token: head.token }; break;
          case 'LEFT':  newHead = { x: head.x - 1, y: head.y, token: head.token }; break;
          case 'RIGHT': newHead = { x: head.x + 1, y: head.y, token: head.token }; break;
        }

        // Check wall collision
        if (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE) {
          setGameOver(true);
          return prev;
        }

        // Check self collision
        if (prev.some(seg => seg.x === newHead.x && seg.y === newHead.y)) {
          setGameOver(true);
          return prev;
        }

        const newSnake = [newHead, ...prev];

        // Check food collision
        if (newHead.x === food.x && newHead.y === food.y) {
          setScore(s => s + 10);
          setFood({
            x: Math.floor(Math.random() * GRID_SIZE),
            y: Math.floor(Math.random() * GRID_SIZE),
            token: TOKENS[Math.floor(Math.random() * TOKENS.length)]
          });
          newSnake[0].token = food.token; // Snake head takes food token
          return newSnake;
        }

        return newSnake.slice(0, -1); // Remove tail
      });
    }, 150);

    return () => clearInterval(gameLoop);
  }, [direction, food, gameOver]);

  // Render canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = '#27272a';
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL_SIZE, 0);
      ctx.lineTo(i * CELL_SIZE, GRID_SIZE * CELL_SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * CELL_SIZE);
      ctx.lineTo(GRID_SIZE * CELL_SIZE, i * CELL_SIZE);
      ctx.stroke();
    }

    // Draw snake
    snake.forEach((seg, i) => {
      ctx.fillStyle = i === 0 ? '#22d3ee' : '#0891b2';
      ctx.fillRect(seg.x * CELL_SIZE, seg.y * CELL_SIZE, CELL_SIZE - 2, CELL_SIZE - 2);

      // Draw token on snake head
      if (i === 0) {
        ctx.fillStyle = '#09090b';
        ctx.font = '8px monospace';
        ctx.fillText(seg.token, seg.x * CELL_SIZE + 2, seg.y * CELL_SIZE + 12);
      }
    });

    // Draw food
    ctx.fillStyle = '#a855f7';
    ctx.fillRect(food.x * CELL_SIZE, food.y * CELL_SIZE, CELL_SIZE - 2, CELL_SIZE - 2);
    ctx.fillStyle = '#fff';
    ctx.font = '8px monospace';
    ctx.fillText(food.token, food.x * CELL_SIZE + 2, food.y * CELL_SIZE + 12);

  }, [snake, food]);

  return (
    <div className="flex flex-col items-center gap-4 p-4 bg-[#09090b] rounded-lg">
      <div className="flex justify-between w-full text-sm">
        <span className="text-cyan-400">Score: {score}</span>
        {gameOver && <span className="text-red-400 font-bold">GAME OVER</span>}
      </div>
      <canvas
        ref={canvasRef}
        width={GRID_SIZE * CELL_SIZE}
        height={GRID_SIZE * CELL_SIZE}
        className="border border-[#27272a] rounded"
      />
      <div className="text-xs text-gray-500">Use arrow keys to move</div>
      {gameOver && (
        <button
          onClick={() => {
            setSnake([{ x: 10, y: 10, token: 'const' }]);
            setDirection('RIGHT');
            setScore(0);
            setGameOver(false);
          }}
          className="px-4 py-2 bg-cyan-500 text-black rounded font-bold"
        >
          Play Again
        </button>
      )}
    </div>
  );
}
```

---

#### Game 2: **Type Racer** ⌨️
Competitive typing game where you race against AI or other users.

**Implementation:**
```typescript
// client/src/plugins/games/TypeRacer.tsx
import { useState, useEffect, useRef } from 'react';
import { useSocket } from '../../contexts/SocketProvider';

const CODE_SNIPPETS = [
  'const fibonacci = (n) => n <= 1 ? n : fibonacci(n-1) + fibonacci(n-2);',
  'function quicksort(arr) { if (arr.length <= 1) return arr; }',
  'const debounce = (fn, delay) => { let timer; return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); }; };',
  'async function fetchData(url) { const res = await fetch(url); return res.json(); }',
];

export default function TypeRacer() {
  const [snippet, setSnippet] = useState('');
  const [input, setInput] = useState('');
  const [startTime, setStartTime] = useState<number | null>(null);
  const [wpm, setWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [isRacing, setIsRacing] = useState(false);
  const [competitors, setCompetitors] = useState<{ id: string; name: string; progress: number }[]>([]);
  const { send, lastMessage } = useSocket();

  useEffect(() => {
    // Random snippet on mount
    setSnippet(CODE_SNIPPETS[Math.floor(Math.random() * CODE_SNIPPETS.length)]);
  }, []);

  useEffect(() => {
    if (!lastMessage) return;
    if (lastMessage.type === 'typeracer_progress') {
      setCompetitors(lastMessage.competitors);
    }
  }, [lastMessage]);

  const startRace = () => {
    setIsRacing(true);
    setStartTime(Date.now());
    setInput('');
    send({ type: 'typeracer_start', snippet });
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!isRacing) return;
    const val = e.target.value;
    setInput(val);

    // Calculate WPM
    if (startTime) {
      const elapsed = (Date.now() - startTime) / 1000 / 60; // minutes
      const words = val.length / 5; // standard word = 5 chars
      setWpm(Math.round(words / elapsed));
    }

    // Calculate accuracy
    let correct = 0;
    for (let i = 0; i < val.length; i++) {
      if (val[i] === snippet[i]) correct++;
    }
    setAccuracy(Math.round((correct / val.length) * 100) || 100);

    // Broadcast progress
    const progress = (val.length / snippet.length) * 100;
    send({ type: 'typeracer_progress', progress });

    // Check completion
    if (val === snippet) {
      setIsRacing(false);
      send({ type: 'typeracer_complete', wpm, accuracy });
    }
  };

  const getCharClass = (i: number) => {
    if (i >= input.length) return 'text-gray-600';
    return input[i] === snippet[i] ? 'text-green-400' : 'text-red-400 bg-red-500/20';
  };

  return (
    <div className="flex flex-col gap-4 p-4 bg-[#09090b] rounded-lg max-w-3xl">
      <div className="flex justify-between text-sm">
        <span className="text-cyan-400">WPM: {wpm}</span>
        <span className="text-purple-400">Accuracy: {accuracy}%</span>
      </div>

      {/* Competitors */}
      {competitors.length > 0 && (
        <div className="flex flex-col gap-2">
          {competitors.map(comp => (
            <div key={comp.id} className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-24 truncate">{comp.name}</span>
              <div className="flex-1 h-2 bg-[#27272a] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all"
                  style={{ width: `${comp.progress}%` }}
                />
              </div>
              <span className="text-xs text-gray-500">{Math.round(comp.progress)}%</span>
            </div>
          ))}
        </div>
      )}

      {/* Snippet Display */}
      <div className="p-4 bg-[#18181b] rounded border border-[#27272a] font-mono text-sm leading-relaxed">
        {snippet.split('').map((char, i) => (
          <span key={i} className={getCharClass(i)}>{char}</span>
        ))}
      </div>

      {/* Input Area */}
      <textarea
        value={input}
        onChange={handleInput}
        disabled={!isRacing}
        placeholder={isRacing ? 'Type the code above...' : 'Click Start Race to begin'}
        className="w-full h-24 p-4 bg-[#09090b] border border-[#27272a] rounded font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500"
      />

      {!isRacing && (
        <button
          onClick={startRace}
          className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded font-bold hover:scale-105 transition-transform"
        >
          Start Race
        </button>
      )}
    </div>
  );
}
```

---

#### Game 3: **Bug Hunt** 🐛
Find the bugs in code snippets. Multiplayer competitive mode.

**Implementation:**
```typescript
// client/src/plugins/games/BugHunt.tsx
import { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';

interface BugChallenge {
  code: string;
  bugs: { line: number; description: string }[];
  difficulty: 'easy' | 'medium' | 'hard';
}

const CHALLENGES: BugChallenge[] = [
  {
    difficulty: 'easy',
    code: `function add(a, b) {
  return a + b
}
console.log(add(1, 2))`,
    bugs: [
      { line: 2, description: 'Missing semicolon' },
    ]
  },
  {
    difficulty: 'medium',
    code: `async function fetchUser(id) {
  const response = fetch('/api/users/' + id)
  return response.json()
}`,
    bugs: [
      { line: 2, description: 'Missing await before fetch' },
      { line: 3, description: 'Missing await before response.json()' },
    ]
  },
  {
    difficulty: 'hard',
    code: `function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}
for (let i = 0; i <= 50; i++) {
  fibonacci(i);
}`,
    bugs: [
      { line: 5, description: 'Stack overflow - memoization needed' },
      { line: 6, description: 'Result not captured or logged' },
    ]
  }
];

export default function BugHunt() {
  const [challenge, setChallenge] = useState<BugChallenge>(CHALLENGES[0]);
  const [selectedLines, setSelectedLines] = useState<Set<number>>(new Set());
  const [foundBugs, setFoundBugs] = useState<number[]>([]);
  const [wrongGuesses, setWrongGuesses] = useState<number[]>([]);
  const [timeLeft, setTimeLeft] = useState(60);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setIsPlaying(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isPlaying]);

  const startGame = () => {
    setIsPlaying(true);
    setTimeLeft(60);
    setSelectedLines(new Set());
    setFoundBugs([]);
    setWrongGuesses([]);
    setChallenge(CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)]);
  };

  const handleLineClick = (lineNum: number) => {
    if (!isPlaying) return;
    if (foundBugs.includes(lineNum) || wrongGuesses.includes(lineNum)) return;

    const isBugLine = challenge.bugs.some(b => b.line === lineNum);

    if (isBugLine) {
      setFoundBugs(prev => [...prev, lineNum]);
      setScore(prev => prev + 100);

      // Check if all bugs found
      if (foundBugs.length + 1 === challenge.bugs.length) {
        setScore(prev => prev + timeLeft * 10); // Bonus for remaining time
        setIsPlaying(false);
      }
    } else {
      setWrongGuesses(prev => [...prev, lineNum]);
      setScore(prev => Math.max(0, prev - 20));
    }
  };

  const lines = challenge.code.split('\n');

  return (
    <div className="flex flex-col gap-4 p-4 bg-[#09090b] rounded-lg max-w-2xl">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <span className="text-cyan-400 font-bold">Score: {score}</span>
          <span className={`flex items-center gap-1 ${timeLeft < 10 ? 'text-red-400 animate-pulse' : 'text-gray-400'}`}>
            <Clock size={16} /> {timeLeft}s
          </span>
        </div>
        <span className={`px-2 py-1 rounded text-xs font-bold ${
          challenge.difficulty === 'easy' ? 'bg-green-500/20 text-green-400' :
          challenge.difficulty === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
          'bg-red-500/20 text-red-400'
        }`}>
          {challenge.difficulty.toUpperCase()}
        </span>
      </div>

      {/* Instructions */}
      <div className="text-sm text-gray-400">
        Click on lines that contain bugs. Found: {foundBugs.length}/{challenge.bugs.length}
      </div>

      {/* Code Display */}
      <div className="bg-[#18181b] rounded border border-[#27272a] overflow-hidden">
        {lines.map((line, i) => {
          const lineNum = i + 1;
          const isBugLine = challenge.bugs.some(b => b.line === lineNum);
          const isFound = foundBugs.includes(lineNum);
          const isWrong = wrongGuesses.includes(lineNum);

          return (
            <div
              key={i}
              onClick={() => handleLineClick(lineNum)}
              className={`flex items-center gap-2 px-4 py-1 cursor-pointer hover:bg-[#27272a]/50 transition-colors font-mono text-sm ${
                isFound ? 'bg-green-500/10 border-l-2 border-green-500' :
                isWrong ? 'bg-red-500/10 border-l-2 border-red-500' :
                ''
              }`}
            >
              <span className="text-gray-600 select-none w-6 text-right">{lineNum}</span>
              <span className="flex-1 text-gray-300">{line}</span>
              {isFound && <CheckCircle2 size={16} className="text-green-400" />}
              {isWrong && <XCircle size={16} className="text-red-400" />}
            </div>
          );
        })}
      </div>

      {/* Bug Descriptions (after found) */}
      {foundBugs.length > 0 && (
        <div className="flex flex-col gap-2">
          {challenge.bugs.filter(b => foundBugs.includes(b.line)).map((bug, i) => (
            <div key={i} className="text-xs text-green-400 bg-green-500/10 p-2 rounded border border-green-500/20">
              Line {bug.line}: {bug.description}
            </div>
          ))}
        </div>
      )}

      {/* Start/Restart Button */}
      {!isPlaying && (
        <button
          onClick={startGame}
          className="px-6 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded font-bold hover:scale-105 transition-transform"
        >
          {score > 0 ? 'Play Again' : 'Start Hunt'}
        </button>
      )}
    </div>
  );
}
```

---

### Category 2: **Collaborative Games** (Use existing WebSocket)

#### Game 4: **Code Chess** ♟️
Turn-based game where each move requires writing a small code snippet.

#### Game 5: **Collaborative Tower Defense** 🗼
All users in a project defend against "bugs" by writing defensive code.

---

### Category 3: **Educational Games**

#### Game 6: **Algorithm Visualizer Battles**
Users race to implement sorting algorithms, visualized in real-time.

#### Game 7: **RegEx Golf** ⛳
Write the shortest regex to match given patterns.

---

## 🔧 Plugin System Architecture

```typescript
// shared/src/types/plugin.ts
export interface GamePlugin {
  id: string;
  name: string;
  category: 'arcade' | 'educational' | 'collaborative';
  component: React.ComponentType;
  icon: string;
  multiplayer: boolean;
  minPlayers?: number;
  maxPlayers?: number;
}

// client/src/plugins/registry.ts
import CodeSnake from './games/CodeSnake';
import TypeRacer from './games/TypeRacer';
import BugHunt from './games/BugHunt';

export const GAME_PLUGINS: GamePlugin[] = [
  {
    id: 'code-snake',
    name: 'Code Snake',
    category: 'arcade',
    component: CodeSnake,
    icon: '🐍',
    multiplayer: false,
  },
  {
    id: 'type-racer',
    name: 'Type Racer',
    category: 'arcade',
    component: TypeRacer,
    icon: '⌨️',
    multiplayer: true,
    minPlayers: 2,
    maxPlayers: 10,
  },
  {
    id: 'bug-hunt',
    name: 'Bug Hunt',
    category: 'educational',
    component: BugHunt,
    icon: '🐛',
    multiplayer: false,
  },
];
```

---

## 🎮 UI Integration

### Option 1: Games Modal (Recommended)
```typescript
// client/src/components/GamesModal.tsx
import { useState } from 'react';
import { X, Gamepad2 } from 'lucide-react';
import { GAME_PLUGINS } from '../plugins/registry';

export default function GamesModal({ onClose }: { onClose: () => void }) {
  const [selectedGame, setSelectedGame] = useState<string | null>(null);

  const game = GAME_PLUGINS.find(g => g.id === selectedGame);
  const GameComponent = game?.component;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-[#09090b] border border-[#27272a] rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#27272a] bg-[#18181b]">
          <div className="flex items-center gap-2">
            <Gamepad2 size={20} className="text-purple-400" />
            <h2 className="font-bold text-lg">Arcade</h2>
          </div>
          <button onClick={onClose} className="hover:bg-[#27272a] p-1 rounded transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {!selectedGame ? (
            <div className="grid grid-cols-3 gap-4">
              {GAME_PLUGINS.map(plugin => (
                <button
                  key={plugin.id}
                  onClick={() => setSelectedGame(plugin.id)}
                  className="flex flex-col items-center gap-2 p-6 bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] rounded-lg transition-all hover:scale-105"
                >
                  <span className="text-4xl">{plugin.icon}</span>
                  <span className="font-semibold">{plugin.name}</span>
                  <span className="text-xs text-gray-500 uppercase">{plugin.category}</span>
                  {plugin.multiplayer && (
                    <span className="text-xs text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded">
                      Multiplayer
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <button
                onClick={() => setSelectedGame(null)}
                className="text-sm text-gray-400 hover:text-cyan-400 self-start"
              >
                ← Back to Games
              </button>
              {GameComponent && <GameComponent />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

### Add to Workspace Top Bar:
```typescript
// client/src/components/Workspace.tsx
const [showGames, setShowGames] = useState(false);

// In top bar, after "Vibe Reels" button:
<button
  onClick={() => setShowGames(true)}
  className="text-xs px-3 py-1.5 rounded flex items-center gap-2 transition-all font-semibold shadow-sm bg-gradient-to-r from-purple-600 to-pink-600 hover:scale-105 text-white"
>
  <Gamepad2 size={14} />
  Arcade
</button>

{showGames && <GamesModal onClose={() => setShowGames(false)} />}
```

---

## 🏆 Gamification Features

### Achievement System
```typescript
// shared/src/types/achievements.ts
export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  requirement: {
    type: 'game_score' | 'game_wins' | 'code_lines' | 'bugs_fixed';
    threshold: number;
  };
  unlocked: boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'snake_master',
    title: 'Snake Master',
    description: 'Score 500+ in Code Snake',
    icon: '🐍',
    requirement: { type: 'game_score', threshold: 500 },
    unlocked: false,
  },
  {
    id: 'speedtyper',
    title: 'Speed Demon',
    description: 'Type 100+ WPM in Type Racer',
    icon: '⚡',
    requirement: { type: 'game_score', threshold: 100 },
    unlocked: false,
  },
  {
    id: 'bug_slayer',
    title: 'Bug Slayer',
    description: 'Find all bugs in 5 consecutive challenges',
    icon: '🗡️',
    requirement: { type: 'game_wins', threshold: 5 },
    unlocked: false,
  },
];
```

---

## 🎯 Easter Egg Integration

### Secret Game: **Ingineri Amărâți: The Game**
**Trigger:** Type `/play amarati` in chat

**Concept:**
Platformer where you play as a tired engineer avoiding "deadlines" (enemies), collecting coffee (power-ups), and reaching "deployment" (goal).

**Implementation:** Use [Phaser.js](https://phaser.io/) embedded in a modal.

---

## 📊 Leaderboard System

```typescript
// server/src/db/schema.ts
export const gameScores = sqliteTable("game_scores", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  gameId: text("game_id").notNull(),
  score: integer("score").notNull(),
  metadata: text("metadata"), // JSON: { wpm, accuracy, level, etc }
  timestamp: integer("timestamp").notNull(),
});

// API endpoint
// server/src/routes/games.ts
app.get('/api/games/:gameId/leaderboard', async (c) => {
  const gameId = c.req.param('gameId');
  const topScores = await db
    .select()
    .from(gameScores)
    .where(eq(gameScores.gameId, gameId))
    .orderBy(desc(gameScores.score))
    .limit(10);
  return c.json({ success: true, leaderboard: topScores });
});
```

---

## 🚀 Implementation Timeline

**Phase 1 (4-6 hours):**
- [ ] Plugin registry system
- [ ] Games modal UI
- [ ] Code Snake implementation

**Phase 2 (6-8 hours):**
- [ ] Type Racer + multiplayer
- [ ] Bug Hunt
- [ ] Leaderboard API

**Phase 3 (8-10 hours):**
- [ ] Achievement system
- [ ] Secret "Amărâți" game
- [ ] Polish + animations

---

## 🎨 Visual Design

Use the same dark theme:
- Background: `#09090b`
- Borders: `#27272a`
- Accent: Cyan (`#22d3ee`) and Purple (`#a855f7`)
- Monospace font for code-related elements

---

## 🔗 Multiplayer Integration

All games use the existing WebSocket infrastructure:

```typescript
// Send game event
send({
  type: 'game_event',
  gameId: 'type-racer',
  event: 'progress_update',
  data: { progress: 45, wpm: 87 }
});

// Receive game event
useEffect(() => {
  if (lastMessage?.type === 'game_event' && lastMessage.gameId === 'type-racer') {
    // Update game state
  }
}, [lastMessage]);
```

---

## 💡 Additional Ideas

1. **Daily Challenges** — New challenge every day, streak tracking
2. **Team Tournaments** — Project teams compete against each other
3. **Game Streaming** — Spectate others playing (like Twitch)
4. **Betting System** — Bet points on who will win Type Racer
5. **Game Replays** — Save and replay epic games

---

## 📖 Resources

- [HTML5 Canvas Tutorial](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial)
- [Phaser.js Docs](https://phaser.io/learn)
- [Game Development Patterns](https://gameprogrammingpatterns.com/)

---

**Status:** Ready for implementation
**Estimated Total Time:** 18-24 hours
**Priority:** P2 (High value-add for demo)
