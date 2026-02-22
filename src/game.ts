export interface Player {
  id: number
  name: string
  totalScore: number
  inJail: boolean
  turns: number[]  // cumulative totals after each valid scoring turn
}

export const TARGET_SCORE = 10_000
export const JAIL_MINIMUM = 500

export function createScoreboard() {
  return {
    players: [] as Player[],
    newPlayerName: '',
    currentPlayerIndex: 0,
    turnScore: '' as string,
    lastMessage: '',

    get currentPlayer(): Player | null {
      return this.players[this.currentPlayerIndex] ?? null
    },

    get winner(): Player | null {
      return this.players.find(p => p.totalScore === TARGET_SCORE) ?? null
    },

    get gameStarted(): boolean {
      return this.players.length >= 2
    },

    get scoreRows(): (number | null)[][] {
      const maxTurns = Math.max(0, ...this.players.map(p => p.turns.length))
      return Array.from({ length: maxTurns }, (_, i) =>
        this.players.map(p => p.turns[i] ?? null)
      )
    },

    addPlayer() {
      const name = this.newPlayerName.trim()
      if (!name || this.players.some(p => p.name === name)) return
      this.players.push({ id: Date.now(), name, totalScore: 0, inJail: true, turns: [] })
      this.newPlayerName = ''
    },

    removePlayer(id: number) {
      this.players = this.players.filter(p => p.id !== id)
      if (this.currentPlayerIndex >= this.players.length) {
        this.currentPlayerIndex = 0
      }
    },

    recordTurn() {
      const score = parseInt(this.turnScore, 10)
      if (isNaN(score) || score < 0 || !this.currentPlayer || this.winner) return

      const player = this.currentPlayer
      this.lastMessage = ''

      if (player.inJail) {
        if (score < JAIL_MINIMUM) {
          this.lastMessage = `${player.name} is in jail — need ${JAIL_MINIMUM}+ to escape. Turn skipped.`
        } else {
          player.inJail = false
          player.totalScore += score
          player.turns.push(player.totalScore)
        }
      } else {
        if (player.totalScore + score > TARGET_SCORE) {
          this.lastMessage = `Too high! Score would exceed ${TARGET_SCORE}. ${player.name}'s turn is wasted.`
        } else {
          player.totalScore += score
          player.turns.push(player.totalScore)
        }
      }

      this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length
      this.turnScore = ''
    },

    resetScores() {
      this.players.forEach(p => {
        p.totalScore = 0
        p.inJail = true
        p.turns = []
      })
      this.currentPlayerIndex = 0
      this.lastMessage = ''
    },
  }
}
