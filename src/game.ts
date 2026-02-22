export interface Player {
  id: number
  name: string
  totalScore: number
  turns: number[]
}

export const TARGET_SCORE = 10_000

export function createScoreboard() {
  return {
    players: [] as Player[],
    newPlayerName: '',
    currentPlayerIndex: 0,
    turnScore: '' as string,

    get currentPlayer(): Player | null {
      return this.players[this.currentPlayerIndex] ?? null
    },

    get winner(): Player | null {
      return this.players.find(p => p.totalScore >= TARGET_SCORE) ?? null
    },

    get gameStarted(): boolean {
      return this.players.length >= 2
    },

    addPlayer() {
      const name = this.newPlayerName.trim()
      if (!name || this.players.some(p => p.name === name)) return
      this.players.push({ id: Date.now(), name, totalScore: 0, turns: [] })
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
      this.currentPlayer.turns.push(score)
      this.currentPlayer.totalScore += score
      this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length
      this.turnScore = ''
    },

    resetScores() {
      this.players.forEach(p => {
        p.totalScore = 0
        p.turns = []
      })
      this.currentPlayerIndex = 0
    },
  }
}
