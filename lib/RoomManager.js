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

  addRaisedHand(roomId, hand) {
    this.initializeRoom(roomId)
    const hands = this.roomRaisedHands.get(roomId)
    if (hands.some((h) => h.userId === hand.userId)) return null
    hands.push(hand)
    this.updateRoomActivity(roomId)
    return hand
  }

  removeRaisedHand(roomId, userId) {
    this.initializeRoom(roomId)
    const hands = this.roomRaisedHands.get(roomId)
    const idx = hands.findIndex((h) => h.userId === userId)
    if (idx === -1) return false
    hands.splice(idx, 1)
    this.updateRoomActivity(roomId)
    return true
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
