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
