# Polls & Q&A Voting Design Spec

**Date:** 2026-05-28
**Status:** Approved

---

## Goal

Wire the commented-out poll voting and Q&A logic in `signaling-server.js`, connect `PollBanner.tsx` to live vote events, and build `QAPanel.tsx` as a new side panel — making both features fully functional end-to-end.

---

## Approach

Add five helper methods to `RoomManager` (matching the existing `addMessage` pattern) to keep socket handlers thin. Extend client types, add Q&A state to stores, expose four new methods on `PeerManagerHandle`, and build `QAPanel` as a side panel wired through `RoomV2`.

---

## Section 1 — Signaling Server (`signaling-server.js`)

### RoomManager additions

Five new methods added to the `RoomManager` class:

```js
addPoll(roomId, poll)
// Pushes poll to roomPolls.get(roomId). Caps at 20 polls per room.

recordPollVote(roomId, pollId, socketId, optionIndex)
// Finds poll by id in roomPolls. Sets poll.votes[socketId] = optionIndex.
// One vote per socket — overwrite is allowed (user can change vote).
// Returns the updated poll, or null if poll not found or not active.

addQuestion(roomId, question)
// Pushes question to roomQuestions.get(roomId). Caps at 50 per room.

recordQuestionVote(roomId, questionId, socketId)
// Finds question by id. If socketId NOT in question.votedBy:
//   question.votes += 1; question.votedBy.push(socketId)
// Returns updated question, or null if not found or already voted.

recordQuestionAnswer(roomId, questionId, answer, answeredBy)
// Finds question by id. Sets answer, answeredBy, answeredAt, isAnswered = true.
// Returns updated question, or null if not found.
```

Each method calls `this.initializeRoom(roomId)` and `this.updateRoomActivity(roomId)` to stay consistent with `addMessage`.

### Socket handler fixes

Five handlers updated. All were previously no-ops or missing parameters:

**`create-poll`** (was: broadcasts but doesn't persist):
```js
socket.on('create-poll', (pollData) => {
  // ... rate limit check ...
  const user = users[socket.id]
  if (user && user.roomId) {
    const poll = {
      ...pollData,
      id: Date.now() + Math.random(),
      roomId: user.roomId,
      createdBy: user.name,
      createdAt: Date.now(),
      votes: {},
      isActive: true,
    }
    roomManager.addPoll(user.roomId, poll)
    io.to(user.roomId).emit('new-poll', poll)
  }
})
```

**`vote-poll`** (was: no-op, missing `voteData` param):
```js
socket.on('vote-poll', (voteData) => {
  // ... rate limit check ...
  const user = users[socket.id]
  if (user && user.roomId) {
    const updated = roomManager.recordPollVote(user.roomId, voteData.pollId, socket.id, voteData.optionIndex)
    if (updated) io.to(user.roomId).emit('poll-updated', updated)
  }
})
```

**`submit-question`** (was: broadcasts but doesn't persist):
```js
socket.on('submit-question', (questionData) => {
  // ... rate limit check ...
  const user = users[socket.id]
  if (user && user.roomId) {
    const question = {
      ...questionData,
      id: Date.now() + Math.random(),
      roomId: user.roomId,
      author: user.name,
      authorId: socket.id,
      timestamp: Date.now(),
      votes: 0,
      votedBy: [],
      answer: null,
      answeredBy: null,
      answeredAt: null,
      isAnswered: false,
    }
    roomManager.addQuestion(user.roomId, question)
    io.to(user.roomId).emit('new-question', question)
  }
})
```

**`vote-question`** (was: no-op, missing `voteData` param):
```js
socket.on('vote-question', (voteData) => {
  // ... rate limit check ...
  const user = users[socket.id]
  if (user && user.roomId) {
    const updated = roomManager.recordQuestionVote(user.roomId, voteData.questionId, socket.id)
    if (updated) io.to(user.roomId).emit('question-updated', updated)
  }
})
```

**`answer-question`** (was: no-op, missing `answerData` param):
```js
socket.on('answer-question', (answerData) => {
  // ... rate limit check ...
  const user = users[socket.id]
  if (user && user.roomId) {
    const updated = roomManager.recordQuestionAnswer(
      user.roomId, answerData.questionId,
      sanitizeInput(answerData.answer), user.name
    )
    if (updated) io.to(user.roomId).emit('question-updated', updated)
  }
})
```

History on join is already wired — `polls-history` and `questions-history` are emitted from `getRoomData()` which reads directly from the Maps.

---

## Section 2 — Types (`src/v2/types/index.ts`)

### Extended `Poll`

```ts
export interface Poll {
  id: string
  question: string
  options: string[]
  createdAt: number
  createdBy: string
  isActive: boolean
  votes: Record<string, number>   // socketId → optionIndex
}
```

### New `Question`

```ts
export interface Question {
  id: string
  text: string
  author: string
  authorId: string
  timestamp: number
  votes: number
  votedBy: string[]        // socketIds — prevents double-voting
  answer: string | null
  answeredBy: string | null
  answeredAt: number | null
  isAnswered: boolean
}
```

---

## Section 3 — State

### `useSessionStore` (`src/v2/store/useSessionStore.ts`)

Add Q&A state:

```ts
questions: Question[]
addQuestion: (q: Question) => void
updateQuestion: (q: Question) => void        // replaces in array by id
setQuestionsHistory: (qs: Question[]) => void
```

Initial value: `questions: []`.

`updateQuestion` replaces the matching question by `id` in the array. If not found, appends.

### `useUIStore` (`src/v2/store/useUIStore.ts`)

Add Q&A panel toggle:

```ts
isQAOpen: boolean
toggleQA: () => void
```

`toggleQA` follows the same pattern as `toggleChat` and `toggleParticipants` — opening Q&A closes the other two panels:

```ts
toggleQA: () => set((s) => ({ isQAOpen: !s.isQAOpen, isChatOpen: false, isParticipantsOpen: false }))
```

Update `toggleChat` and `toggleParticipants` to also close `isQAOpen`:

```ts
toggleChat: () => set((s) => ({ isChatOpen: !s.isChatOpen, isParticipantsOpen: false, isQAOpen: false }))
toggleParticipants: () => set((s) => ({ isParticipantsOpen: !s.isParticipantsOpen, isChatOpen: false, isQAOpen: false }))
```

---

## Section 4 — PeerManager (`src/v2/call/PeerManager.tsx`)

### New socket listeners (added to existing connect `useEffect`)

```ts
socket.on('poll-updated', (poll: Poll) => { setActivePoll(poll) })
socket.on('polls-history', (polls: Poll[]) => {
  const active = polls.findLast((p) => p.isActive) ?? null
  setActivePoll(active)
})
socket.on('new-question', (q: Question) => { addQuestion(q) })
socket.on('question-updated', (q: Question) => { updateQuestion(q) })
socket.on('questions-history', (qs: Question[]) => { setQuestionsHistory(qs) })
```

All new listeners are removed in the cleanup `return` alongside existing ones.

### New `PeerManagerHandle` methods

```ts
interface PeerManagerHandle {
  // existing:
  sendMessage(text: string): void
  sendReaction(emoji: string): void
  // new:
  votePoll(pollId: string, optionIndex: number): void
  submitQuestion(text: string): void
  voteQuestion(questionId: string): void
  answerQuestion(questionId: string, answer: string): void
}
```

Implemented via `useImperativeHandle`. Each emits to `socketRef.current` and is a no-op if the socket is null:

```ts
votePoll: (pollId, optionIndex) => socketRef.current?.emit('vote-poll', { pollId, optionIndex }),
submitQuestion: (text) => socketRef.current?.emit('submit-question', { text }),
voteQuestion: (questionId) => socketRef.current?.emit('vote-question', { questionId }),
answerQuestion: (questionId, answer) => socketRef.current?.emit('answer-question', { questionId, answer }),
```

---

## Section 5 — PollBanner (`src/v2/call/PollBanner.tsx`)

### Changes

**New prop:**
```ts
interface PollBannerProps {
  onVotePoll: (pollId: string, optionIndex: number) => void
}
```

**Local voted state:**
```ts
const [votedIndex, setVotedIndex] = useState<number | null>(null)
```
Reset when `activePoll.id` changes:
```ts
useEffect(() => { setVotedIndex(null) }, [activePoll?.id])
```

**Derived vote counts:**
```ts
const counts = activePoll.options.map((_, i) =>
  Object.values(activePoll.votes).filter((v) => v === i).length
)
const totalVotes = counts.reduce((a, b) => a + b, 0)
```

**Updated buttons** — enabled, wired, show vote counts:
```tsx
{activePoll.options.map((option, i) => (
  <button
    key={option}
    data-testid={`poll-option-${option}`}
    disabled={votedIndex !== null}
    onClick={() => { onVotePoll(activePoll.id, i); setVotedIndex(i) }}
    className={`... ${votedIndex === i ? 'border-[var(--accent-live)]' : ''}`}
  >
    <span>{option}</span>
    <span className="text-xs opacity-60">
      {counts[i]}{totalVotes > 0 ? ` (${Math.round((counts[i] / totalVotes) * 100)}%)` : ''}
    </span>
  </button>
))}
```

---

## Section 6 — QAPanel (`src/v2/call/QAPanel.tsx`)

New component. Same side-panel layout pattern as `ChatPanel`.

### Props

```ts
interface QAPanelProps {
  onSubmitQuestion: (text: string) => void
  onVoteQuestion: (questionId: string) => void
  onAnswerQuestion: (questionId: string, answer: string) => void
}
```

### Behaviour

- Reads `questions` from `useSessionStore`
- Displays questions sorted by `votes` descending
- Each question row:
  - Author name + timestamp
  - Question text
  - Upvote button with count — `disabled` if local socket's peerId is in `votedBy` (use `useCallStore` local peerId)... **Note:** `votedBy` contains socketIds from the server; client doesn't easily know its own socketId. Simplification: disable upvote after clicking once per session via local `Set<string>` state (`votedIds`). This avoids the need to expose socketId to the client.
  - If `isAnswered`: answer displayed below in a green-tinted box (`bg-green-50 dark:bg-green-900/20`) with "Answered by {answeredBy}"
  - If not answered: inline text input + "Answer" button below the question (collapsed by default, expanded on click)
- Bottom: new question text input + "Ask" button. Clears on submit. Disabled if empty.

### Local state

```ts
const [draft, setDraft] = useState('')           // new question input
const [votedIds, setVotedIds] = useState<Set<string>>(new Set())
const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({})
const [expandedAnswerIds, setExpandedAnswerIds] = useState<Set<string>>(new Set())
```

---

## Section 7 — ControlBar + RoomV2

### `ControlBar` (`src/v2/call/ControlBar.tsx`)

Add Q&A button between 👥 and Leave:

```tsx
const isQAOpen = useUIStore((s) => s.isQAOpen)
const toggleQA = useUIStore((s) => s.toggleQA)

<Button
  data-testid="btn-qa"
  variant={isQAOpen ? 'primary' : 'ghost'}
  onClick={toggleQA}
  aria-label="Q&A"
>
  🙋
</Button>
```

### `RoomV2` (`src/v2/pages/RoomV2.tsx`)

Three changes:

1. Read `isQAOpen` from `useUIStore`
2. Pass `onVotePoll` to `PollBanner`:
```tsx
<PollBanner onVotePoll={(id, idx) => peerManagerRef.current?.votePoll(id, idx)} />
```
3. Render `QAPanel` when open:
```tsx
{isQAOpen && (
  <QAPanel
    onSubmitQuestion={(text) => peerManagerRef.current?.submitQuestion(text)}
    onVoteQuestion={(id) => peerManagerRef.current?.voteQuestion(id)}
    onAnswerQuestion={(id, ans) => peerManagerRef.current?.answerQuestion(id, ans)}
  />
)}
```

---

## Files Changed

| File | Change |
|------|--------|
| `signaling-server.js` | 5 new `RoomManager` methods, 5 handler fixes |
| `src/v2/types/index.ts` | Extend `Poll`, add `Question` |
| `src/v2/store/useSessionStore.ts` | Add `questions`, `addQuestion`, `updateQuestion`, `setQuestionsHistory` |
| `src/v2/store/useUIStore.ts` | Add `isQAOpen`, `toggleQA`; update `toggleChat`/`toggleParticipants` |
| `src/v2/call/PeerManager.tsx` | 5 new socket listeners, 4 new handle methods |
| `src/v2/call/PollBanner.tsx` | Enable voting, show vote counts |
| `src/v2/call/QAPanel.tsx` | New component |
| `src/v2/call/ControlBar.tsx` | Add Q&A toggle button |
| `src/v2/pages/RoomV2.tsx` | Wire `onVotePoll`, render `QAPanel` |

## Files Created

| File | Purpose |
|------|---------|
| `src/v2/call/QAPanel.tsx` | Q&A side panel |

---

## Done When

- Polls can receive votes and show live vote counts in `PollBanner`
- Q&A questions can be submitted, upvoted, and answered
- Server broadcasts correct updated state to all room participants
- No TODO comments remain in `signaling-server.js` for these features
- All new unit tests pass
