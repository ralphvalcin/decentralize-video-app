# Polls & Q&A Voting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire five broken socket handlers in `signaling-server.js`, connect `PollBanner.tsx` to live vote events, and build `QAPanel.tsx` as a functional side panel — making poll voting and Q&A fully functional end-to-end.

**Architecture:** Extract `RoomManager` from `signaling-server.js` into `lib/RoomManager.js` so it can be unit tested, add five new methods to it, and fix five no-op socket handlers. On the client side: extend types, add Q&A state to stores, expose four new methods on `PeerManagerHandle`, enable interactive voting in `PollBanner`, build `QAPanel`, add a Q&A toggle to `ControlBar`, and wire everything through `RoomV2`.

**Tech Stack:** Node.js + Socket.io (signaling), React 18 + TypeScript + Zustand 4 (client), Jest + React Testing Library (tests)

---

## File Map

| File | Change |
|------|--------|
| `lib/RoomManager.js` | **Create** — extracted RoomManager class (testable) |
| `signaling-server.js` | Replace inline class with `import`, fix 5 handlers |
| `src/v2/types/index.ts` | Extend `Poll`, add `Question` |
| `src/v2/store/useSessionStore.ts` | Add `questions`, `addQuestion`, `updateQuestion`, `setQuestionsHistory` |
| `src/v2/store/useUIStore.ts` | Add `isQAOpen`, `toggleQA`; update `toggleChat`/`toggleParticipants` |
| `src/v2/call/PeerManager.tsx` | 5 new socket listeners, 4 new handle methods |
| `src/v2/call/PollBanner.tsx` | Enable voting, add vote counts |
| `src/v2/call/QAPanel.tsx` | **Create** — Q&A side panel |
| `src/v2/call/ControlBar.tsx` | Add Q&A toggle button |
| `src/v2/pages/RoomV2.tsx` | Wire `onVotePoll`, render `QAPanel` |
| `tests/unit/signaling/RoomManager.test.js` | **Create** — unit tests for new methods |
| `tests/unit/v2/stores/useSessionStore.test.ts` | Add Q&A state tests |
| `tests/unit/v2/stores/useUIStore.test.ts` | Add `isQAOpen`/`toggleQA` tests |
| `tests/unit/v2/call/PeerManager.test.tsx` | Update Poll fixture, add new listener/handle tests |
| `tests/unit/v2/call/PollBanner.test.tsx` | Replace disabled-button tests with voting tests |
| `tests/unit/v2/call/QAPanel.test.tsx` | **Create** — full QAPanel test suite |
| `tests/unit/v2/call/ControlBar.test.tsx` | Add Q&A button tests |

---

### Task 1: Extend Poll type, add Question type

**Files:**
- Modify: `src/v2/types/index.ts`
- Update fixtures: `tests/unit/v2/call/PollBanner.test.tsx`
- Update fixtures: `tests/unit/v2/stores/useSessionStore.test.ts`
- Update fixtures: `tests/unit/v2/call/PeerManager.test.tsx`

Types are compile-time only — no behavioral test. The test steps verify no regressions in files that create Poll objects.

- [ ] **Step 1: Extend Poll and add Question in `src/v2/types/index.ts`**

Replace the current `Poll` interface and add `Question` after it:

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

export interface Question {
  id: string
  text: string
  author: string
  authorId: string
  timestamp: number
  votes: number
  votedBy: string[]
  answer: string | null
  answeredBy: string | null
  answeredAt: number | null
  isAnswered: boolean
}
```

- [ ] **Step 2: Update Poll fixture in `tests/unit/v2/call/PollBanner.test.tsx`**

Find the existing fixture:
```ts
const poll: Poll = {
  id: 'poll-1',
  question: 'Best time to meet?',
  options: ['9am', '2pm', '5pm'],
  createdAt: Date.now(),
}
```

Replace with:
```ts
const poll: Poll = {
  id: 'poll-1',
  question: 'Best time to meet?',
  options: ['9am', '2pm', '5pm'],
  createdAt: Date.now(),
  createdBy: 'Alice',
  isActive: true,
  votes: {},
}
```

- [ ] **Step 3: Update Poll fixtures in `tests/unit/v2/stores/useSessionStore.test.ts`**

There are two tests that create Poll objects. Update both occurrences of:
```ts
const poll: Poll = { id: 'poll-1', question: 'Q?', options: ['Yes', 'No'], createdAt: 0 }
```

to:
```ts
const poll: Poll = {
  id: 'poll-1',
  question: 'Q?',
  options: ['Yes', 'No'],
  createdAt: 0,
  createdBy: 'Alice',
  isActive: true,
  votes: {},
}
```

- [ ] **Step 4: Update Poll fixture in `tests/unit/v2/call/PeerManager.test.tsx`**

Find the `poll-ended` test (around line 479). It has:
```ts
  useSessionStore.setState({
    activePoll: { id: 'p1', question: 'Ready?', options: ['Yes', 'No'], createdAt: 1 },
  })
```

Replace with:
```ts
  useSessionStore.setState({
    activePoll: { id: 'p1', question: 'Ready?', options: ['Yes', 'No'], createdAt: 1, createdBy: 'Alice', isActive: true, votes: {} },
  })
```

- [ ] **Step 5: Run all tests to confirm no regressions**

```bash
npm test
```

Expected: All existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/v2/types/index.ts tests/unit/v2/call/PollBanner.test.tsx tests/unit/v2/stores/useSessionStore.test.ts tests/unit/v2/call/PeerManager.test.tsx
git commit -m "feat: extend Poll type, add Question type"
```

---

### Task 2: Add Q&A state to useSessionStore

**Files:**
- Modify: `src/v2/store/useSessionStore.ts`
- Modify: `tests/unit/v2/stores/useSessionStore.test.ts`

- [ ] **Step 1: Write failing tests**

Add to the top of `tests/unit/v2/stores/useSessionStore.test.ts`, after the existing imports:

```ts
import type { ChatMessage, Poll, Question } from '../../../../src/v2/types'

const makeQuestion = (overrides: Partial<Question> = {}): Question => ({
  id: 'q-1',
  text: 'How do I join?',
  author: 'Bob',
  authorId: 'socket-1',
  timestamp: 1000,
  votes: 0,
  votedBy: [],
  answer: null,
  answeredBy: null,
  answeredAt: null,
  isAnswered: false,
  ...overrides,
})
```

Update the `beforeEach` to include `questions: []`:
```ts
beforeEach(() => {
  useSessionStore.setState({
    messages: [],
    pinnedMessage: null,
    activePoll: null,
    pollResponses: {},
    recordingState: 'idle',
    recordingConsentPeers: [],
    questions: [],
  })
})
```

Add new tests at the end of the file:
```ts
test('addQuestion appends to questions', () => {
  useSessionStore.getState().addQuestion(makeQuestion())
  expect(useSessionStore.getState().questions).toHaveLength(1)
})

test('updateQuestion replaces question by id', () => {
  const q = makeQuestion({ id: 'q-1', votes: 0 })
  useSessionStore.setState({ questions: [q] })
  useSessionStore.getState().updateQuestion({ ...q, votes: 3 })
  expect(useSessionStore.getState().questions[0].votes).toBe(3)
})

test('updateQuestion appends if id not found', () => {
  useSessionStore.setState({ questions: [] })
  useSessionStore.getState().updateQuestion(makeQuestion({ id: 'q-new' }))
  expect(useSessionStore.getState().questions).toHaveLength(1)
})

test('setQuestionsHistory replaces all questions', () => {
  useSessionStore.setState({ questions: [makeQuestion()] })
  const qs = [makeQuestion({ id: 'q-a' }), makeQuestion({ id: 'q-b' })]
  useSessionStore.getState().setQuestionsHistory(qs)
  expect(useSessionStore.getState().questions).toHaveLength(2)
  expect(useSessionStore.getState().questions[0].id).toBe('q-a')
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern="useSessionStore"
```

Expected: 4 new tests fail with "getState().addQuestion is not a function".

- [ ] **Step 3: Implement in `src/v2/store/useSessionStore.ts`**

Full replacement:

```ts
import { create } from 'zustand'
import type { ChatMessage, Poll, Question } from '../types'

interface SessionStore {
  messages: ChatMessage[]
  pinnedMessage: ChatMessage | null
  activePoll: Poll | null
  pollResponses: Record<string, string>
  recordingState: 'idle' | 'recording' | 'paused'
  recordingConsentPeers: string[]
  questions: Question[]
  addMessage: (msg: ChatMessage) => void
  pinMessage: (msg: ChatMessage) => void
  unpinMessage: () => void
  setActivePoll: (poll: Poll | null) => void
  recordPollResponse: (peerId: string, choiceId: string) => void
  setRecordingState: (state: 'idle' | 'recording' | 'paused') => void
  addRecordingConsent: (peerId: string) => void
  addQuestion: (q: Question) => void
  updateQuestion: (q: Question) => void
  setQuestionsHistory: (qs: Question[]) => void
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  messages: [],
  pinnedMessage: null,
  activePoll: null,
  pollResponses: {},
  recordingState: 'idle',
  recordingConsentPeers: [],
  questions: [],

  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  pinMessage: (msg) => set({ pinnedMessage: msg }),
  unpinMessage: () => set({ pinnedMessage: null }),
  setActivePoll: (poll) => set({ activePoll: poll, pollResponses: {} }),
  recordPollResponse: (peerId, choiceId) =>
    set((s) => ({ pollResponses: { ...s.pollResponses, [peerId]: choiceId } })),
  setRecordingState: (state) => set({ recordingState: state }),
  addRecordingConsent: (peerId) => {
    if (!get().recordingConsentPeers.includes(peerId)) {
      set((s) => ({ recordingConsentPeers: [...s.recordingConsentPeers, peerId] }))
    }
  },
  addQuestion: (q) => set((s) => ({ questions: [...s.questions, q] })),
  updateQuestion: (q) => set((s) => {
    const idx = s.questions.findIndex((x) => x.id === q.id)
    if (idx === -1) return { questions: [...s.questions, q] }
    const next = [...s.questions]
    next[idx] = q
    return { questions: next }
  }),
  setQuestionsHistory: (qs) => set({ questions: qs }),
}))
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern="useSessionStore"
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/v2/store/useSessionStore.ts tests/unit/v2/stores/useSessionStore.test.ts
git commit -m "feat: add Q&A state to useSessionStore"
```

---

### Task 3: Add isQAOpen/toggleQA to useUIStore

**Files:**
- Modify: `src/v2/store/useUIStore.ts`
- Modify: `tests/unit/v2/stores/useUIStore.test.ts`

- [ ] **Step 1: Write failing tests**

Update `beforeEach` in `tests/unit/v2/stores/useUIStore.test.ts` to include `isQAOpen: false`:
```ts
beforeEach(() => {
  useUIStore.setState({
    isChatOpen: false,
    isParticipantsOpen: false,
    isQAOpen: false,
    activeModal: null,
    toasts: [],
    layout: 'spotlight',
  })
})
```

Add new tests at the end of the file:
```ts
test('toggleQA flips isQAOpen', () => {
  useUIStore.getState().toggleQA()
  expect(useUIStore.getState().isQAOpen).toBe(true)
  useUIStore.getState().toggleQA()
  expect(useUIStore.getState().isQAOpen).toBe(false)
})

test('opening QA closes chat and participants', () => {
  useUIStore.setState({ isChatOpen: true, isParticipantsOpen: true })
  useUIStore.getState().toggleQA()
  expect(useUIStore.getState().isQAOpen).toBe(true)
  expect(useUIStore.getState().isChatOpen).toBe(false)
  expect(useUIStore.getState().isParticipantsOpen).toBe(false)
})

test('opening chat closes QA', () => {
  useUIStore.setState({ isQAOpen: true })
  useUIStore.getState().toggleChat()
  expect(useUIStore.getState().isChatOpen).toBe(true)
  expect(useUIStore.getState().isQAOpen).toBe(false)
})

test('opening participants closes QA', () => {
  useUIStore.setState({ isQAOpen: true })
  useUIStore.getState().toggleParticipants()
  expect(useUIStore.getState().isParticipantsOpen).toBe(true)
  expect(useUIStore.getState().isQAOpen).toBe(false)
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern="useUIStore"
```

Expected: 4 new tests fail (toggleQA not a function, isQAOpen unknown).

- [ ] **Step 3: Implement in `src/v2/store/useUIStore.ts`**

Full replacement:

```ts
import { create } from 'zustand'
import type { Toast } from '../types'

interface UIStore {
  isChatOpen: boolean
  isParticipantsOpen: boolean
  isQAOpen: boolean
  activeModal: string | null
  toasts: Toast[]
  layout: 'spotlight' | 'grid'
  toggleChat: () => void
  toggleParticipants: () => void
  toggleQA: () => void
  setActiveModal: (modal: string | null) => void
  addToast: (toast: Toast) => void
  removeToast: (id: string) => void
  setLayout: (layout: 'spotlight' | 'grid') => void
}

export const useUIStore = create<UIStore>((set) => ({
  isChatOpen: false,
  isParticipantsOpen: false,
  isQAOpen: false,
  activeModal: null,
  toasts: [],
  layout: 'spotlight',

  // Panels are mutually exclusive: opening any one closes the other two.
  toggleChat: () => set((s) => ({ isChatOpen: !s.isChatOpen, isParticipantsOpen: false, isQAOpen: false })),
  toggleParticipants: () => set((s) => ({ isParticipantsOpen: !s.isParticipantsOpen, isChatOpen: false, isQAOpen: false })),
  toggleQA: () => set((s) => ({ isQAOpen: !s.isQAOpen, isChatOpen: false, isParticipantsOpen: false })),

  setActiveModal: (modal) => set({ activeModal: modal }),
  addToast: (toast) => set((s) => ({ toasts: [...s.toasts, toast] })),
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  setLayout: (layout) => set({ layout }),
}))
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern="useUIStore"
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/v2/store/useUIStore.ts tests/unit/v2/stores/useUIStore.test.ts
git commit -m "feat: add isQAOpen/toggleQA to useUIStore with three-way mutual exclusion"
```

---

### Task 4: RoomManager extraction + 5 new methods + 5 handler fixes

**Files:**
- Create: `lib/RoomManager.js`
- Modify: `signaling-server.js`
- Create: `tests/unit/signaling/RoomManager.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/signaling/RoomManager.test.js`:

```js
const { RoomManager } = require('../../../lib/RoomManager')

const mockPerf = {
  recordRoomActivity: jest.fn(),
  recordError: jest.fn(),
}

let rm

beforeEach(() => {
  rm = new RoomManager(mockPerf)
})

// addPoll
test('addPoll stores a poll in the room', () => {
  rm.initializeRoom('r1')
  rm.addPoll('r1', { id: 'p1', question: 'Q?', options: ['Yes', 'No'], isActive: true, votes: {} })
  expect(rm.getRoomData('r1').polls).toHaveLength(1)
})

test('addPoll caps at 20 polls', () => {
  rm.initializeRoom('r1')
  for (let i = 0; i < 25; i++) {
    rm.addPoll('r1', { id: `p${i}`, question: 'Q?', options: [], isActive: true, votes: {} })
  }
  expect(rm.getRoomData('r1').polls).toHaveLength(20)
})

// recordPollVote
test('recordPollVote records vote and returns updated poll', () => {
  rm.initializeRoom('r1')
  rm.addPoll('r1', { id: 'p1', question: 'Q?', options: ['Yes', 'No'], isActive: true, votes: {} })
  const updated = rm.recordPollVote('r1', 'p1', 'socket-1', 0)
  expect(updated).not.toBeNull()
  expect(updated.votes['socket-1']).toBe(0)
})

test('recordPollVote allows changing vote', () => {
  rm.initializeRoom('r1')
  rm.addPoll('r1', { id: 'p1', question: 'Q?', options: ['Yes', 'No'], isActive: true, votes: {} })
  rm.recordPollVote('r1', 'p1', 'socket-1', 0)
  const updated = rm.recordPollVote('r1', 'p1', 'socket-1', 1)
  expect(updated.votes['socket-1']).toBe(1)
})

test('recordPollVote returns null for unknown poll', () => {
  rm.initializeRoom('r1')
  expect(rm.recordPollVote('r1', 'nope', 'socket-1', 0)).toBeNull()
})

test('recordPollVote returns null for inactive poll', () => {
  rm.initializeRoom('r1')
  rm.addPoll('r1', { id: 'p1', question: 'Q?', options: [], isActive: false, votes: {} })
  expect(rm.recordPollVote('r1', 'p1', 'socket-1', 0)).toBeNull()
})

// addQuestion
test('addQuestion stores a question in the room', () => {
  rm.initializeRoom('r1')
  rm.addQuestion('r1', { id: 'q1', text: 'Hello?', votes: 0, votedBy: [], isAnswered: false })
  expect(rm.getRoomData('r1').questions).toHaveLength(1)
})

test('addQuestion caps at 50 questions', () => {
  rm.initializeRoom('r1')
  for (let i = 0; i < 55; i++) {
    rm.addQuestion('r1', { id: `q${i}`, text: 'Q?', votes: 0, votedBy: [], isAnswered: false })
  }
  expect(rm.getRoomData('r1').questions).toHaveLength(50)
})

// recordQuestionVote
test('recordQuestionVote increments votes and returns question', () => {
  rm.initializeRoom('r1')
  rm.addQuestion('r1', { id: 'q1', text: 'Q?', votes: 0, votedBy: [], isAnswered: false })
  const updated = rm.recordQuestionVote('r1', 'q1', 'socket-1')
  expect(updated.votes).toBe(1)
  expect(updated.votedBy).toContain('socket-1')
})

test('recordQuestionVote prevents double-voting by same socket', () => {
  rm.initializeRoom('r1')
  rm.addQuestion('r1', { id: 'q1', text: 'Q?', votes: 0, votedBy: [], isAnswered: false })
  rm.recordQuestionVote('r1', 'q1', 'socket-1')
  const second = rm.recordQuestionVote('r1', 'q1', 'socket-1')
  expect(second).toBeNull()
})

test('recordQuestionVote returns null for unknown question', () => {
  rm.initializeRoom('r1')
  expect(rm.recordQuestionVote('r1', 'nope', 'socket-1')).toBeNull()
})

// recordQuestionAnswer
test('recordQuestionAnswer sets answer fields and marks isAnswered', () => {
  rm.initializeRoom('r1')
  rm.addQuestion('r1', { id: 'q1', text: 'Q?', votes: 0, votedBy: [], isAnswered: false, answer: null, answeredBy: null, answeredAt: null })
  const updated = rm.recordQuestionAnswer('r1', 'q1', 'Because.', 'Alice')
  expect(updated.answer).toBe('Because.')
  expect(updated.answeredBy).toBe('Alice')
  expect(updated.isAnswered).toBe(true)
  expect(typeof updated.answeredAt).toBe('number')
})

test('recordQuestionAnswer returns null for unknown question', () => {
  rm.initializeRoom('r1')
  expect(rm.recordQuestionAnswer('r1', 'nope', 'A', 'Alice')).toBeNull()
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern="RoomManager"
```

Expected: All tests fail with "Cannot find module '../../../lib/RoomManager'".

- [ ] **Step 3: Create `lib/RoomManager.js`**

```js
import { EventEmitter } from 'events'

export class RoomManager extends EventEmitter {
  constructor(performanceMonitor, config, cron) {
    super()
    this.performanceMonitor = performanceMonitor
    this.config = config || { MESSAGE_HISTORY_LIMIT: 100, INACTIVE_ROOM_TTL: 3600000 }
    this.roomMessages = new Map()
    this.roomPolls = new Map()
    this.roomQuestions = new Map()
    this.roomReactions = new Map()
    this.roomRaisedHands = new Map()
    this.roomMetadata = new Map()
    if (cron) this.startCleanupScheduler(cron)
  }

  initializeRoom(roomId) {
    if (!this.roomMessages.has(roomId)) {
      this.roomMessages.set(roomId, [])
      this.roomPolls.set(roomId, [])
      this.roomQuestions.set(roomId, [])
      this.roomReactions.set(roomId, [])
      this.roomRaisedHands.set(roomId, [])
      this.roomMetadata.set(roomId, {
        createdAt: Date.now(),
        lastActivity: Date.now(),
        participantCount: 0,
      })
      this.performanceMonitor.recordRoomActivity(roomId, 'created')
      this.emit('room-created', roomId)
    }
    this.updateRoomActivity(roomId)
  }

  updateRoomActivity(roomId) {
    const metadata = this.roomMetadata.get(roomId)
    if (metadata) metadata.lastActivity = Date.now()
  }

  addMessage(roomId, message) {
    this.initializeRoom(roomId)
    const messages = this.roomMessages.get(roomId)
    messages.push(message)
    if (messages.length > this.config.MESSAGE_HISTORY_LIMIT) {
      messages.splice(0, messages.length - this.config.MESSAGE_HISTORY_LIMIT)
    }
    this.updateRoomActivity(roomId)
  }

  addPoll(roomId, poll) {
    this.initializeRoom(roomId)
    const polls = this.roomPolls.get(roomId)
    polls.push(poll)
    if (polls.length > 20) polls.splice(0, polls.length - 20)
    this.updateRoomActivity(roomId)
  }

  recordPollVote(roomId, pollId, socketId, optionIndex) {
    this.initializeRoom(roomId)
    const poll = this.roomPolls.get(roomId).find((p) => p.id === pollId)
    if (!poll || !poll.isActive) return null
    poll.votes[socketId] = optionIndex
    this.updateRoomActivity(roomId)
    return poll
  }

  addQuestion(roomId, question) {
    this.initializeRoom(roomId)
    const questions = this.roomQuestions.get(roomId)
    questions.push(question)
    if (questions.length > 50) questions.splice(0, questions.length - 50)
    this.updateRoomActivity(roomId)
  }

  recordQuestionVote(roomId, questionId, socketId) {
    this.initializeRoom(roomId)
    const question = this.roomQuestions.get(roomId).find((q) => q.id === questionId)
    if (!question) return null
    if (question.votedBy.includes(socketId)) return null
    question.votes += 1
    question.votedBy.push(socketId)
    this.updateRoomActivity(roomId)
    return question
  }

  recordQuestionAnswer(roomId, questionId, answer, answeredBy) {
    this.initializeRoom(roomId)
    const question = this.roomQuestions.get(roomId).find((q) => q.id === questionId)
    if (!question) return null
    question.answer = answer
    question.answeredBy = answeredBy
    question.answeredAt = Date.now()
    question.isAnswered = true
    this.updateRoomActivity(roomId)
    return question
  }

  getRoomData(roomId) {
    return {
      messages: this.roomMessages.get(roomId) || [],
      polls: this.roomPolls.get(roomId) || [],
      questions: this.roomQuestions.get(roomId) || [],
      reactions: this.roomReactions.get(roomId) || [],
      raisedHands: this.roomRaisedHands.get(roomId) || [],
    }
  }

  cleanupInactiveRooms() {
    const now = Date.now()
    const toCleanup = []
    for (const [roomId, metadata] of this.roomMetadata) {
      if (now - metadata.lastActivity > this.config.INACTIVE_ROOM_TTL) toCleanup.push(roomId)
    }
    for (const roomId of toCleanup) this.cleanupRoom(roomId)
    if (toCleanup.length > 0) {
      console.log(`Cleaned up ${toCleanup.length} inactive rooms`)
      this.emit('rooms-cleaned', toCleanup)
    }
    return toCleanup.length
  }

  cleanupRoom(roomId) {
    this.roomMessages.delete(roomId)
    this.roomPolls.delete(roomId)
    this.roomQuestions.delete(roomId)
    this.roomReactions.delete(roomId)
    this.roomRaisedHands.delete(roomId)
    this.roomMetadata.delete(roomId)
    this.performanceMonitor.recordRoomActivity(roomId, 'cleaned')
  }

  startCleanupScheduler(cron) {
    cron.schedule('*/5 * * * *', () => {
      const cleanedCount = this.cleanupInactiveRooms()
      console.log(`Room cleanup completed. Cleaned ${cleanedCount} inactive rooms.`)
    })
  }

  getRoomStats() {
    return {
      totalRooms: this.roomMetadata.size,
      roomsWithActivity: Array.from(this.roomMetadata.values())
        .filter((meta) => Date.now() - meta.lastActivity < 3600000).length,
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern="RoomManager"
```

Expected: All 14 tests pass.

- [ ] **Step 5: Update `signaling-server.js`**

**5a. Replace the inline `RoomManager` class with an import.**

The class definition spans lines 284–398. Delete the entire block:
```js
class RoomManager extends EventEmitter {
  // ... entire class body ...
}
```

At the top of the file, after the existing `import { EventEmitter } from 'events'` line, add:
```js
import { RoomManager } from './lib/RoomManager.js'
```

Remove the now-redundant `import { EventEmitter } from 'events'` line (the class file handles it).

**5b. Update the `RoomManager` instantiation** (around line 402, now shifted):

Find: `const roomManager = new RoomManager(performanceMonitor);`  
Replace: `const roomManager = new RoomManager(performanceMonitor, config, cron)`

**5c. Fix `create-poll` handler** — add persistence.

Find inside `socket.on('create-poll', ...)`:
```js
      // roomPolls[user.roomId].push(poll); // TODO: Fix room data management
      io.to(user.roomId).emit('new-poll', poll);
```
Replace with:
```js
      roomManager.addPoll(user.roomId, poll)
      io.to(user.roomId).emit('new-poll', poll)
```

Also update the `id` field in the poll object above it — change:
```js
        id: Date.now() + Math.random(),
```
to:
```js
        id: String(Date.now() + Math.random()),
```

**5d. Fix `vote-poll` handler** — add `voteData` param and logic.

Find: `socket.on('vote-poll', () => {`  
Replace: `socket.on('vote-poll', (voteData) => {`

Find the commented body inside `vote-poll`:
```js
      // const poll = roomPolls[user.roomId].find(p => p.id === voteData.pollId); // TODO: Fix room data management
      // if (poll && poll.isActive) {
      //   poll.votes[socket.id] = voteData.optionIndex;
      //   io.to(user.roomId).emit('poll-updated', poll);
      // } // TODO: Fix room data management
```
Replace with:
```js
      const updated = roomManager.recordPollVote(user.roomId, voteData.pollId, socket.id, voteData.optionIndex)
      if (updated) io.to(user.roomId).emit('poll-updated', updated)
```

**5e. Fix `submit-question` handler** — add persistence.

Find inside `socket.on('submit-question', ...)`:
```js
      // roomQuestions[user.roomId].push(question); // TODO: Fix room data management
      io.to(user.roomId).emit('new-question', question);
```
Replace with:
```js
      roomManager.addQuestion(user.roomId, question)
      io.to(user.roomId).emit('new-question', question)
```

Also update the `id` field — change:
```js
        id: Date.now() + Math.random(),
```
to:
```js
        id: String(Date.now() + Math.random()),
```

**5f. Fix `vote-question` handler** — add `voteData` param and logic.

Find: `socket.on('vote-question', () => {`  
Replace: `socket.on('vote-question', (voteData) => {`

Find the commented body inside `vote-question`:
```js
      // const question = roomQuestions[user.roomId].find(q => q.id === voteData.questionId); // TODO: Fix room data management
      // if (question && !question.votedBy.includes(socket.id)) {
      //   question.votes += 1;
      //   question.votedBy.push(socket.id);
      //   io.to(user.roomId).emit('question-updated', question);
      // } // TODO: Fix room data management
```
Replace with:
```js
      const updated = roomManager.recordQuestionVote(user.roomId, voteData.questionId, socket.id)
      if (updated) io.to(user.roomId).emit('question-updated', updated)
```

**5g. Fix `answer-question` handler** — add `answerData` param and logic.

Find: `socket.on('answer-question', () => {`  
Replace: `socket.on('answer-question', (answerData) => {`

Find the commented body inside `answer-question`:
```js
      // const question = roomQuestions[user.roomId].find(q => q.id === answerData.questionId); // TODO: Fix room data management
      // if (question) {
      //   question.answer = sanitizeInput(answerData.answer);
      //   question.answeredBy = user.name;
      //   question.answeredAt = Date.now();
      //   question.isAnswered = true;
      //   io.to(user.roomId).emit('question-updated', question);
      // } // TODO: Fix room data management
```
Replace with:
```js
      const updated = roomManager.recordQuestionAnswer(
        user.roomId, answerData.questionId,
        sanitizeInput(answerData.answer), user.name
      )
      if (updated) io.to(user.roomId).emit('question-updated', updated)
```

- [ ] **Step 6: Verify signaling server starts**

```bash
node signaling-server.js &
sleep 2
kill %1
```

Expected: Server prints startup logs without any import or runtime errors.

- [ ] **Step 7: Run full test suite**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
git add lib/RoomManager.js signaling-server.js tests/unit/signaling/RoomManager.test.js
git commit -m "feat: extract RoomManager, add 5 poll/Q&A methods, fix 5 socket handlers"
```

---

### Task 5: PeerManager — 5 new socket listeners + 4 new handle methods

**Files:**
- Modify: `src/v2/call/PeerManager.tsx`
- Modify: `tests/unit/v2/call/PeerManager.test.tsx`

- [ ] **Step 1: Write failing tests**

In `tests/unit/v2/call/PeerManager.test.tsx`, update the `beforeEach` store reset to include `questions: []`:

```ts
beforeEach(() => {
  // ... existing peer/socket clears ...
  usePeerStore.setState({ peers: new Map() })
  useSessionStore.setState({ messages: [], questions: [] })
  useCallStore.setState({ userName: 'Ralph' })
})
```

Add new tests at the end of the file:

```ts
test('poll-updated sets activePoll in session store', async () => {
  await act(async () => { render(<PeerManager roomId="room-1" />) })
  act(() => {
    fireSocketEvent('poll-updated', {
      id: 'p1', question: 'Q?', options: ['Yes', 'No'],
      createdAt: 1, createdBy: 'Alice', isActive: true, votes: { 'socket-a': 0 },
    })
  })
  expect(useSessionStore.getState().activePoll?.id).toBe('p1')
  expect(useSessionStore.getState().activePoll?.votes).toEqual({ 'socket-a': 0 })
})

test('polls-history sets the last active poll', async () => {
  await act(async () => { render(<PeerManager roomId="room-1" />) })
  act(() => {
    fireSocketEvent('polls-history', [
      { id: 'p-old', question: 'Old?', options: [], createdAt: 1, createdBy: 'Alice', isActive: false, votes: {} },
      { id: 'p-active', question: 'Active?', options: [], createdAt: 2, createdBy: 'Alice', isActive: true, votes: {} },
    ])
  })
  expect(useSessionStore.getState().activePoll?.id).toBe('p-active')
})

test('polls-history with no active poll sets activePoll to null', async () => {
  await act(async () => { render(<PeerManager roomId="room-1" />) })
  useSessionStore.setState({ activePoll: { id: 'old', question: 'Q?', options: [], createdAt: 1, createdBy: 'Alice', isActive: true, votes: {} } })
  act(() => {
    fireSocketEvent('polls-history', [
      { id: 'p-ended', question: 'Old?', options: [], createdAt: 1, createdBy: 'Alice', isActive: false, votes: {} },
    ])
  })
  expect(useSessionStore.getState().activePoll).toBeNull()
})

test('new-question appends to questions store', async () => {
  await act(async () => { render(<PeerManager roomId="room-1" />) })
  act(() => {
    fireSocketEvent('new-question', {
      id: 'q1', text: 'Hello?', author: 'Bob', authorId: 's1',
      timestamp: 1000, votes: 0, votedBy: [], answer: null,
      answeredBy: null, answeredAt: null, isAnswered: false,
    })
  })
  expect(useSessionStore.getState().questions).toHaveLength(1)
  expect(useSessionStore.getState().questions[0].id).toBe('q1')
})

test('question-updated calls updateQuestion in store', async () => {
  await act(async () => { render(<PeerManager roomId="room-1" />) })
  useSessionStore.setState({
    questions: [{
      id: 'q1', text: 'Hello?', author: 'Bob', authorId: 's1',
      timestamp: 1000, votes: 0, votedBy: [], answer: null,
      answeredBy: null, answeredAt: null, isAnswered: false,
    }],
  })
  act(() => {
    fireSocketEvent('question-updated', {
      id: 'q1', text: 'Hello?', author: 'Bob', authorId: 's1',
      timestamp: 1000, votes: 5, votedBy: ['s2'], answer: null,
      answeredBy: null, answeredAt: null, isAnswered: false,
    })
  })
  expect(useSessionStore.getState().questions[0].votes).toBe(5)
})

test('questions-history replaces questions in store', async () => {
  await act(async () => { render(<PeerManager roomId="room-1" />) })
  act(() => {
    fireSocketEvent('questions-history', [
      { id: 'q-a', text: 'First?', author: 'Alice', authorId: 's1', timestamp: 1, votes: 0, votedBy: [], answer: null, answeredBy: null, answeredAt: null, isAnswered: false },
      { id: 'q-b', text: 'Second?', author: 'Bob', authorId: 's2', timestamp: 2, votes: 0, votedBy: [], answer: null, answeredBy: null, answeredAt: null, isAnswered: false },
    ])
  })
  expect(useSessionStore.getState().questions).toHaveLength(2)
  expect(useSessionStore.getState().questions[0].id).toBe('q-a')
})

test('votePoll emits vote-poll via socket', async () => {
  const ref = createRef<PeerManagerHandle>()
  await act(async () => { render(<PeerManager ref={ref} roomId="room-1" />) })
  act(() => { ref.current?.votePoll('poll-1', 0) })
  expect(mockSocket.emit).toHaveBeenCalledWith('vote-poll', { pollId: 'poll-1', optionIndex: 0 })
})

test('submitQuestion emits submit-question via socket', async () => {
  const ref = createRef<PeerManagerHandle>()
  await act(async () => { render(<PeerManager ref={ref} roomId="room-1" />) })
  act(() => { ref.current?.submitQuestion('When is it?') })
  expect(mockSocket.emit).toHaveBeenCalledWith('submit-question', { text: 'When is it?' })
})

test('voteQuestion emits vote-question via socket', async () => {
  const ref = createRef<PeerManagerHandle>()
  await act(async () => { render(<PeerManager ref={ref} roomId="room-1" />) })
  act(() => { ref.current?.voteQuestion('q-1') })
  expect(mockSocket.emit).toHaveBeenCalledWith('vote-question', { questionId: 'q-1' })
})

test('answerQuestion emits answer-question via socket', async () => {
  const ref = createRef<PeerManagerHandle>()
  await act(async () => { render(<PeerManager ref={ref} roomId="room-1" />) })
  act(() => { ref.current?.answerQuestion('q-1', 'Because.') })
  expect(mockSocket.emit).toHaveBeenCalledWith('answer-question', { questionId: 'q-1', answer: 'Because.' })
})

test('unmount removes Q&A socket listeners', async () => {
  let unmount!: () => void
  await act(async () => { unmount = render(<PeerManager roomId="room-1" />).unmount })
  mockSocket.off.mockClear()
  act(() => { unmount() })
  expect(mockSocket.off).toHaveBeenCalledWith('poll-updated')
  expect(mockSocket.off).toHaveBeenCalledWith('polls-history')
  expect(mockSocket.off).toHaveBeenCalledWith('new-question')
  expect(mockSocket.off).toHaveBeenCalledWith('question-updated')
  expect(mockSocket.off).toHaveBeenCalledWith('questions-history')
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern="PeerManager"
```

Expected: 11 new tests fail (no such listeners/methods yet).

- [ ] **Step 3: Implement in `src/v2/call/PeerManager.tsx`**

**3a. Update imports** — add `Question` to the types import:
```ts
import type { PeerRecord, Poll, Question } from '../types'
```

**3b. Update `PeerManagerHandle` interface**:
```ts
export interface PeerManagerHandle {
  sendMessage: (text: string) => void
  sendReaction: (emoji: string) => void
  votePoll: (pollId: string, optionIndex: number) => void
  submitQuestion: (text: string) => void
  voteQuestion: (questionId: string) => void
  answerQuestion: (questionId: string, answer: string) => void
}
```

**3c. Add store selectors** after `const setActivePoll = useSessionStore((s) => s.setActivePoll)`:
```ts
const addQuestion = useSessionStore((s) => s.addQuestion)
const updateQuestion = useSessionStore((s) => s.updateQuestion)
const setQuestionsHistory = useSessionStore((s) => s.setQuestionsHistory)
```

**3d. Update `useImperativeHandle`**:
```ts
useImperativeHandle(ref, () => ({
  sendMessage: (text) => {
    socketRef.current?.emit('send-message', { text, timestamp: Date.now() })
  },
  sendReaction: (emoji) => {
    socketRef.current?.emit('send-reaction', { emoji })
  },
  votePoll: (pollId, optionIndex) => {
    socketRef.current?.emit('vote-poll', { pollId, optionIndex })
  },
  submitQuestion: (text) => {
    socketRef.current?.emit('submit-question', { text })
  },
  voteQuestion: (questionId) => {
    socketRef.current?.emit('vote-question', { questionId })
  },
  answerQuestion: (questionId, answer) => {
    socketRef.current?.emit('answer-question', { questionId, answer })
  },
}), [])
```

**3e. Add 5 new socket listeners** inside the connect `useEffect`, after the existing `socket.on('poll-ended', ...)` listener:
```ts
socket.on('poll-updated', (poll: Poll) => {
  setActivePoll(poll)
})

socket.on('polls-history', (polls: Poll[]) => {
  const active = polls.findLast((p) => p.isActive) ?? null
  setActivePoll(active)
})

socket.on('new-question', (q: Question) => {
  addQuestion(q)
})

socket.on('question-updated', (q: Question) => {
  updateQuestion(q)
})

socket.on('questions-history', (qs: Question[]) => {
  setQuestionsHistory(qs)
})
```

**3f. Update the cleanup `return`** to remove the 5 new listeners:
```ts
return () => {
  socket.off('turn-credentials')
  socket.off('turn-credentials-error')
  socket.off('poll-updated')
  socket.off('polls-history')
  socket.off('new-question')
  socket.off('question-updated')
  socket.off('questions-history')
  socket.emit('user-leaving')
  socket.disconnect()
  peerConnsRef.current.forEach((_, id) => destroyPeerConn(id))
  peerConnsRef.current.clear()
  socketRef.current = null
  reactionTimersRef.current.forEach(clearTimeout)
  reactionTimersRef.current.clear()
}
```

**3g. Update the useEffect dependency array** to include the three new store selectors:
```ts
}, [roomId, userName, setPeer, removePeer, patchPeer, addMessage, setActivePoll, addQuestion, updateQuestion, setQuestionsHistory])
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern="PeerManager"
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/v2/call/PeerManager.tsx tests/unit/v2/call/PeerManager.test.tsx
git commit -m "feat: PeerManager Q&A listeners + votePoll/submitQuestion/voteQuestion/answerQuestion handle methods"
```

---

### Task 6: PollBanner — interactive voting + vote counts

**Files:**
- Modify: `src/v2/call/PollBanner.tsx`
- Modify (full replace): `tests/unit/v2/call/PollBanner.test.tsx`

- [ ] **Step 1: Write failing tests**

Replace the entire contents of `tests/unit/v2/call/PollBanner.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { PollBanner } from '../../../../src/v2/call/PollBanner'
import { useSessionStore } from '../../../../src/v2/store/useSessionStore'
import type { Poll } from '../../../../src/v2/types'

const poll: Poll = {
  id: 'poll-1',
  question: 'Best time to meet?',
  options: ['9am', '2pm', '5pm'],
  createdAt: Date.now(),
  createdBy: 'Alice',
  isActive: true,
  votes: {},
}

const pollWithVotes: Poll = {
  ...poll,
  votes: { 'socket-a': 0, 'socket-b': 0, 'socket-c': 1 },
}

beforeEach(() => {
  useSessionStore.setState({ activePoll: null, pollResponses: {} })
})

test('renders nothing when no active poll', () => {
  const { container } = render(<PollBanner onVotePoll={jest.fn()} />)
  expect(container.firstChild).toBeNull()
})

test('renders poll question when poll is active', () => {
  useSessionStore.setState({ activePoll: poll })
  render(<PollBanner onVotePoll={jest.fn()} />)
  expect(screen.getByTestId('poll-banner')).toBeInTheDocument()
  expect(screen.getByText('Best time to meet?')).toBeInTheDocument()
})

test('renders all poll options', () => {
  useSessionStore.setState({ activePoll: poll })
  render(<PollBanner onVotePoll={jest.fn()} />)
  expect(screen.getByText('9am')).toBeInTheDocument()
  expect(screen.getByText('2pm')).toBeInTheDocument()
  expect(screen.getByText('5pm')).toBeInTheDocument()
})

test('each option has its own testid', () => {
  useSessionStore.setState({ activePoll: poll })
  render(<PollBanner onVotePoll={jest.fn()} />)
  expect(screen.getByTestId('poll-option-9am')).toBeInTheDocument()
  expect(screen.getByTestId('poll-option-2pm')).toBeInTheDocument()
  expect(screen.getByTestId('poll-option-5pm')).toBeInTheDocument()
})

test('options are enabled before voting', () => {
  useSessionStore.setState({ activePoll: poll })
  render(<PollBanner onVotePoll={jest.fn()} />)
  expect(screen.getByTestId('poll-option-9am')).not.toBeDisabled()
})

test('clicking option calls onVotePoll with correct pollId and optionIndex', () => {
  useSessionStore.setState({ activePoll: poll })
  const onVotePoll = jest.fn()
  render(<PollBanner onVotePoll={onVotePoll} />)
  fireEvent.click(screen.getByTestId('poll-option-9am'))
  expect(onVotePoll).toHaveBeenCalledWith('poll-1', 0)
})

test('after voting all options become disabled', () => {
  useSessionStore.setState({ activePoll: poll })
  render(<PollBanner onVotePoll={jest.fn()} />)
  fireEvent.click(screen.getByTestId('poll-option-9am'))
  expect(screen.getByTestId('poll-option-9am')).toBeDisabled()
  expect(screen.getByTestId('poll-option-2pm')).toBeDisabled()
  expect(screen.getByTestId('poll-option-5pm')).toBeDisabled()
})

test('shows vote counts and percentages', () => {
  useSessionStore.setState({ activePoll: pollWithVotes })
  render(<PollBanner onVotePoll={jest.fn()} />)
  // 2 votes for index 0 (9am) = 67%, 1 vote for index 1 (2pm) = 33%, 0 for 5pm
  expect(screen.getByText('2 (67%)')).toBeInTheDocument()
  expect(screen.getByText('1 (33%)')).toBeInTheDocument()
  expect(screen.getByText('0')).toBeInTheDocument()
})

test('votedIndex resets when poll id changes', () => {
  useSessionStore.setState({ activePoll: poll })
  const { rerender } = render(<PollBanner onVotePoll={jest.fn()} />)
  fireEvent.click(screen.getByTestId('poll-option-9am'))
  expect(screen.getByTestId('poll-option-9am')).toBeDisabled()

  const poll2: Poll = { ...poll, id: 'poll-2' }
  useSessionStore.setState({ activePoll: poll2 })
  rerender(<PollBanner onVotePoll={jest.fn()} />)
  expect(screen.getByTestId('poll-option-9am')).not.toBeDisabled()
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern="PollBanner"
```

Expected: Tests fail — `PollBanner` doesn't accept `onVotePoll` prop yet and buttons are disabled.

- [ ] **Step 3: Implement in `src/v2/call/PollBanner.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { useSessionStore } from '../store/useSessionStore'

interface PollBannerProps {
  onVotePoll: (pollId: string, optionIndex: number) => void
}

export function PollBanner({ onVotePoll }: PollBannerProps) {
  const activePoll = useSessionStore((s) => s.activePoll)
  const [votedIndex, setVotedIndex] = useState<number | null>(null)

  useEffect(() => {
    setVotedIndex(null)
  }, [activePoll?.id])

  if (!activePoll) return null

  const counts = activePoll.options.map((_, i) =>
    Object.values(activePoll.votes ?? {}).filter((v) => v === i).length
  )
  const totalVotes = counts.reduce((a, b) => a + b, 0)

  return (
    <div
      data-testid="poll-banner"
      className="absolute top-4 left-1/2 -translate-x-1/2 bg-[var(--surface-overlay)] border border-[var(--border-default)] rounded-[12px] px-6 py-4 max-w-sm w-full shadow-lg z-10"
    >
      <p className="text-[var(--text-primary)] text-sm font-medium mb-3">{activePoll.question}</p>
      <div className="flex flex-col gap-2">
        {activePoll.options.map((option, i) => (
          <button
            key={option}
            data-testid={`poll-option-${option}`}
            disabled={votedIndex !== null}
            onClick={() => {
              onVotePoll(activePoll.id, i)
              setVotedIndex(i)
            }}
            className={`text-left text-xs text-[var(--text-secondary)] bg-[var(--surface-raised)] hover:bg-[var(--surface-hover)] border rounded-[8px] px-3 py-2 transition-colors flex items-center justify-between ${
              votedIndex === i ? 'border-[var(--accent-live)]' : 'border-[var(--border-subtle)]'
            }`}
          >
            <span>{option}</span>
            <span className="text-xs opacity-60">
              {counts[i]}{totalVotes > 0 ? ` (${Math.round((counts[i] / totalVotes) * 100)}%)` : ''}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern="PollBanner"
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/v2/call/PollBanner.tsx tests/unit/v2/call/PollBanner.test.tsx
git commit -m "feat: PollBanner interactive voting with live vote counts"
```

---

### Task 7: Build QAPanel

**Files:**
- Create: `src/v2/call/QAPanel.tsx`
- Create: `tests/unit/v2/call/QAPanel.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/v2/call/QAPanel.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { QAPanel } from '../../../../src/v2/call/QAPanel'
import { useSessionStore } from '../../../../src/v2/store/useSessionStore'
import type { Question } from '../../../../src/v2/types'

const makeQuestion = (overrides: Partial<Question> = {}): Question => ({
  id: 'q-1',
  text: 'How do I join?',
  author: 'Bob',
  authorId: 'socket-1',
  timestamp: 1000,
  votes: 0,
  votedBy: [],
  answer: null,
  answeredBy: null,
  answeredAt: null,
  isAnswered: false,
  ...overrides,
})

const defaultProps = {
  onSubmitQuestion: jest.fn(),
  onVoteQuestion: jest.fn(),
  onAnswerQuestion: jest.fn(),
}

beforeEach(() => {
  useSessionStore.setState({ questions: [] })
  jest.clearAllMocks()
})

test('renders QA panel with Q&A header', () => {
  render(<QAPanel {...defaultProps} />)
  expect(screen.getByTestId('qa-panel')).toBeInTheDocument()
  expect(screen.getByText('Q&A')).toBeInTheDocument()
})

test('renders empty state when no questions', () => {
  render(<QAPanel {...defaultProps} />)
  expect(screen.getByTestId('qa-empty')).toBeInTheDocument()
})

test('renders question text', () => {
  useSessionStore.setState({ questions: [makeQuestion()] })
  render(<QAPanel {...defaultProps} />)
  expect(screen.getByText('How do I join?')).toBeInTheDocument()
})

test('renders question author', () => {
  useSessionStore.setState({ questions: [makeQuestion()] })
  render(<QAPanel {...defaultProps} />)
  expect(screen.getByText('Bob')).toBeInTheDocument()
})

test('renders vote count', () => {
  useSessionStore.setState({ questions: [makeQuestion({ votes: 5 })] })
  render(<QAPanel {...defaultProps} />)
  expect(screen.getByText('5')).toBeInTheDocument()
})

test('upvote button calls onVoteQuestion with question id', () => {
  useSessionStore.setState({ questions: [makeQuestion({ id: 'q-1' })] })
  render(<QAPanel {...defaultProps} />)
  fireEvent.click(screen.getByTestId('btn-upvote-q-1'))
  expect(defaultProps.onVoteQuestion).toHaveBeenCalledWith('q-1')
})

test('upvote button is disabled after clicking', () => {
  useSessionStore.setState({ questions: [makeQuestion({ id: 'q-1' })] })
  render(<QAPanel {...defaultProps} />)
  const btn = screen.getByTestId('btn-upvote-q-1')
  fireEvent.click(btn)
  expect(btn).toBeDisabled()
})

test('shows answered question with answer box', () => {
  useSessionStore.setState({
    questions: [makeQuestion({ isAnswered: true, answer: 'Click Join.', answeredBy: 'Alice' })],
  })
  render(<QAPanel {...defaultProps} />)
  expect(screen.getByTestId('qa-answer')).toBeInTheDocument()
  expect(screen.getByText('Click Join.')).toBeInTheDocument()
  expect(screen.getByText(/Alice/)).toBeInTheDocument()
})

test('sorts questions by votes descending', () => {
  useSessionStore.setState({
    questions: [
      makeQuestion({ id: 'q-low', text: 'Low votes', votes: 1 }),
      makeQuestion({ id: 'q-high', text: 'High votes', votes: 10 }),
    ],
  })
  render(<QAPanel {...defaultProps} />)
  const items = screen.getAllByTestId(/^qa-question-/)
  expect(items[0]).toHaveTextContent('High votes')
  expect(items[1]).toHaveTextContent('Low votes')
})

test('clicking Answer expands inline answer input', () => {
  useSessionStore.setState({ questions: [makeQuestion({ id: 'q-1', isAnswered: false })] })
  render(<QAPanel {...defaultProps} />)
  fireEvent.click(screen.getByTestId('btn-expand-answer-q-1'))
  expect(screen.getByTestId('answer-input-q-1')).toBeInTheDocument()
})

test('submitting answer calls onAnswerQuestion and closes input', () => {
  useSessionStore.setState({ questions: [makeQuestion({ id: 'q-1', isAnswered: false })] })
  render(<QAPanel {...defaultProps} />)
  fireEvent.click(screen.getByTestId('btn-expand-answer-q-1'))
  fireEvent.change(screen.getByTestId('answer-input-q-1'), { target: { value: 'Because.' } })
  fireEvent.click(screen.getByTestId('btn-submit-answer-q-1'))
  expect(defaultProps.onAnswerQuestion).toHaveBeenCalledWith('q-1', 'Because.')
})

test('ask input submits new question via onSubmitQuestion and clears field', () => {
  render(<QAPanel {...defaultProps} />)
  const input = screen.getByTestId('qa-ask-input')
  fireEvent.change(input, { target: { value: 'When is it?' } })
  fireEvent.click(screen.getByTestId('btn-ask'))
  expect(defaultProps.onSubmitQuestion).toHaveBeenCalledWith('When is it?')
  expect((input as HTMLInputElement).value).toBe('')
})

test('ask button is disabled when input is empty', () => {
  render(<QAPanel {...defaultProps} />)
  expect(screen.getByTestId('btn-ask')).toBeDisabled()
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern="QAPanel"
```

Expected: All 13 tests fail ("Cannot find module ... QAPanel").

- [ ] **Step 3: Create `src/v2/call/QAPanel.tsx`**

```tsx
import { useState } from 'react'
import { useSessionStore } from '../store/useSessionStore'
import type { Question } from '../types'

interface QAPanelProps {
  onSubmitQuestion: (text: string) => void
  onVoteQuestion: (questionId: string) => void
  onAnswerQuestion: (questionId: string, answer: string) => void
}

export function QAPanel({ onSubmitQuestion, onVoteQuestion, onAnswerQuestion }: QAPanelProps) {
  const questions = useSessionStore((s) => s.questions)
  const [draft, setDraft] = useState('')
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set())
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({})
  const [expandedAnswerIds, setExpandedAnswerIds] = useState<Set<string>>(new Set())

  const sorted = [...questions].sort((a, b) => b.votes - a.votes)

  function handleUpvote(q: Question) {
    onVoteQuestion(q.id)
    setVotedIds((prev) => new Set(prev).add(q.id))
  }

  function handleExpandAnswer(id: string) {
    setExpandedAnswerIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleSubmitAnswer(id: string) {
    const text = (answerDrafts[id] ?? '').trim()
    if (!text) return
    onAnswerQuestion(id, text)
    setAnswerDrafts((prev) => ({ ...prev, [id]: '' }))
    setExpandedAnswerIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  function handleAsk() {
    const text = draft.trim()
    if (!text) return
    onSubmitQuestion(text)
    setDraft('')
  }

  return (
    <div
      data-testid="qa-panel"
      className="w-[280px] shrink-0 border-l border-[var(--border-subtle)] flex flex-col bg-[var(--surface-base)]"
    >
      <div className="px-4 py-3 border-b border-[var(--border-subtle)] shrink-0">
        <span className="text-[var(--text-primary)] text-sm font-semibold">Q&A</span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-3">
        {sorted.length === 0 ? (
          <p data-testid="qa-empty" className="text-[var(--text-secondary)] text-xs text-center mt-4">
            No questions yet
          </p>
        ) : (
          sorted.map((q) => (
            <div
              key={q.id}
              data-testid={`qa-question-${q.id}`}
              className="border border-[var(--border-subtle)] rounded-[8px] p-3 flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-[var(--text-primary)] text-xs font-medium">{q.text}</p>
                  <p className="text-[var(--text-secondary)] text-[10px] mt-0.5">{q.author}</p>
                </div>
                <div className="flex flex-col items-center shrink-0">
                  <button
                    data-testid={`btn-upvote-${q.id}`}
                    disabled={votedIds.has(q.id)}
                    onClick={() => handleUpvote(q)}
                    className="text-xs text-[var(--text-secondary)] hover:text-[var(--accent-live)] disabled:opacity-40 disabled:cursor-default"
                  >
                    ▲
                  </button>
                  <span className="text-[10px] text-[var(--text-secondary)]">{q.votes}</span>
                </div>
              </div>

              {q.isAnswered ? (
                <div
                  data-testid="qa-answer"
                  className="bg-green-50 dark:bg-green-900/20 rounded-[6px] px-2 py-1.5 text-xs"
                >
                  <p className="text-green-800 dark:text-green-200">{q.answer}</p>
                  <p className="text-green-600 dark:text-green-400 text-[10px] mt-0.5">
                    Answered by {q.answeredBy}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <button
                    data-testid={`btn-expand-answer-${q.id}`}
                    onClick={() => handleExpandAnswer(q.id)}
                    className="text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-left"
                  >
                    {expandedAnswerIds.has(q.id) ? 'Cancel' : 'Answer'}
                  </button>
                  {expandedAnswerIds.has(q.id) && (
                    <div className="flex gap-1">
                      <input
                        data-testid={`answer-input-${q.id}`}
                        value={answerDrafts[q.id] ?? ''}
                        onChange={(e) =>
                          setAnswerDrafts((prev) => ({ ...prev, [q.id]: e.target.value }))
                        }
                        placeholder="Type answer…"
                        className="flex-1 text-[10px] bg-[var(--surface-raised)] border border-[var(--border-subtle)] rounded-[4px] px-2 py-1 text-[var(--text-primary)] outline-none"
                      />
                      <button
                        data-testid={`btn-submit-answer-${q.id}`}
                        onClick={() => handleSubmitAnswer(q.id)}
                        className="text-[10px] px-2 py-1 bg-[var(--accent-live)] text-white rounded-[4px]"
                      >
                        Submit
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="px-3 py-2 border-t border-[var(--border-subtle)] flex gap-2 shrink-0">
        <input
          data-testid="qa-ask-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
          placeholder="Ask a question…"
          className="flex-1 text-xs bg-[var(--surface-raised)] border border-[var(--border-subtle)] rounded-[8px] px-3 py-2 text-[var(--text-primary)] outline-none"
        />
        <button
          data-testid="btn-ask"
          disabled={!draft.trim()}
          onClick={handleAsk}
          className="text-xs px-3 py-2 bg-[var(--accent-live)] text-white rounded-[8px] disabled:opacity-40 disabled:cursor-default"
        >
          Ask
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern="QAPanel"
```

Expected: All 13 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/v2/call/QAPanel.tsx tests/unit/v2/call/QAPanel.test.tsx
git commit -m "feat: build QAPanel with submit, upvote, and inline answer"
```

---

### Task 8: ControlBar — add Q&A toggle button

**Files:**
- Modify: `src/v2/call/ControlBar.tsx`
- Modify: `tests/unit/v2/call/ControlBar.test.tsx`

- [ ] **Step 1: Write failing tests**

Update the `beforeEach` in `tests/unit/v2/call/ControlBar.test.tsx` to include `isQAOpen: false`:
```ts
beforeEach(() => {
  useCallStore.setState({ isMuted: false, isCamOff: false })
  useUIStore.setState({ isChatOpen: false, isParticipantsOpen: false, isQAOpen: false })
  jest.useFakeTimers()
})
```

Add new tests at the end of the file:
```ts
test('Q&A button exists in control bar', () => {
  render(<ControlBar onEndCall={jest.fn()} />)
  expect(screen.getByTestId('btn-qa')).toBeInTheDocument()
})

test('Q&A button toggles isQAOpen in store', () => {
  render(<ControlBar onEndCall={jest.fn()} />)
  fireEvent.click(screen.getByTestId('btn-qa'))
  expect(useUIStore.getState().isQAOpen).toBe(true)
  fireEvent.click(screen.getByTestId('btn-qa'))
  expect(useUIStore.getState().isQAOpen).toBe(false)
})

test('Q&A button renders with primary variant when isQAOpen', () => {
  useUIStore.setState({ isQAOpen: true })
  render(<ControlBar onEndCall={jest.fn()} />)
  expect(screen.getByTestId('btn-qa').className).toMatch(/bg-\[var\(--text-primary\)\]/)
})

test('opening Q&A closes chat (mutual exclusion via store)', () => {
  useUIStore.setState({ isChatOpen: true })
  render(<ControlBar onEndCall={jest.fn()} />)
  fireEvent.click(screen.getByTestId('btn-qa'))
  expect(useUIStore.getState().isQAOpen).toBe(true)
  expect(useUIStore.getState().isChatOpen).toBe(false)
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern="ControlBar"
```

Expected: 4 new tests fail (btn-qa not found).

- [ ] **Step 3: Add Q&A button to `src/v2/call/ControlBar.tsx`**

After the existing `toggleParticipants` selector lines, add:
```ts
const isQAOpen = useUIStore((s) => s.isQAOpen)
const toggleQA = useUIStore((s) => s.toggleQA)
```

Add the Q&A button between the participants button and the leave button:
```tsx
<Button
  data-testid="btn-qa"
  variant={isQAOpen ? 'primary' : 'ghost'}
  onClick={toggleQA}
  aria-label="Q&A"
>
  🙋
</Button>
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern="ControlBar"
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/v2/call/ControlBar.tsx tests/unit/v2/call/ControlBar.test.tsx
git commit -m "feat: add Q&A toggle button to ControlBar"
```

---

### Task 9: Wire RoomV2

**Files:**
- Modify: `src/v2/pages/RoomV2.tsx`

No new tests needed — RoomV2 is a wiring-only change and is covered by the component tests added in prior tasks.

- [ ] **Step 1: Update `src/v2/pages/RoomV2.tsx`**

Full replacement:

```tsx
import { useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useCallStore } from '../store/useCallStore'
import { useUIStore } from '../store/useUIStore'
import { MediaController } from '../call/MediaController'
import { PeerManager, type PeerManagerHandle } from '../call/PeerManager'
import { SpotlightView } from '../call/SpotlightView'
import { ThumbnailStrip } from '../call/ThumbnailStrip'
import { ControlBar } from '../call/ControlBar'
import { ChatPanel } from '../call/ChatPanel'
import { ParticipantsPanel } from '../call/ParticipantsPanel'
import { PollBanner } from '../call/PollBanner'
import { QAPanel } from '../call/QAPanel'

export default function RoomV2() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const peerManagerRef = useRef<PeerManagerHandle>(null)
  const userName = useCallStore((s) => s.userName)
  const resetCall = useCallStore((s) => s.reset)
  const isChatOpen = useUIStore((s) => s.isChatOpen)
  const isParticipantsOpen = useUIStore((s) => s.isParticipantsOpen)
  const isQAOpen = useUIStore((s) => s.isQAOpen)

  useEffect(() => {
    if (!userName) navigate(`/?redirect=/room/${roomId}`)
  }, [userName, roomId, navigate])

  return (
    <div className="v2 flex flex-col h-screen bg-[var(--surface-base)]" data-testid="room-v2">
      <MediaController />
      <PeerManager ref={peerManagerRef} roomId={roomId ?? ''} />

      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[var(--accent-live)] shadow-[0_0_6px_var(--accent-live)]" />
          <span className="text-[var(--text-primary)] text-sm font-semibold">{roomId}</span>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="flex flex-col flex-1 min-w-0 relative">
          <SpotlightView />
          <ThumbnailStrip />
          <PollBanner onVotePoll={(id, idx) => peerManagerRef.current?.votePoll(id, idx)} />
          <ControlBar
            onEndCall={() => { resetCall(); navigate('/') }}
            onSendReaction={(emoji) => peerManagerRef.current?.sendReaction(emoji)}
          />
        </div>

        {isChatOpen && (
          <ChatPanel onSendMessage={(text) => peerManagerRef.current?.sendMessage(text)} />
        )}

        {isParticipantsOpen && (
          <ParticipantsPanel />
        )}

        {isQAOpen && (
          <QAPanel
            onSubmitQuestion={(text) => peerManagerRef.current?.submitQuestion(text)}
            onVoteQuestion={(id) => peerManagerRef.current?.voteQuestion(id)}
            onAnswerQuestion={(id, ans) => peerManagerRef.current?.answerQuestion(id, ans)}
          />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run full test suite**

```bash
npm test
```

Expected: All tests pass. Zero failures.

- [ ] **Step 3: Commit**

```bash
git add src/v2/pages/RoomV2.tsx
git commit -m "feat: wire PollBanner onVotePoll and QAPanel into RoomV2"
```
