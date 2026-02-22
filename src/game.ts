export interface TurnEntry {
  cumulative: number
  crosses: number
  deleted: boolean
}

export interface Player {
  id: number
  name: string
  inJail: boolean
  turns: TurnEntry[]
}

export const TARGET_SCORE = 10_000
export const JAIL_MINIMUM = 500
export const MAX_CROSSES = 3

export function playerCurrentScore(player: Player): number {
  for (let i = player.turns.length - 1; i >= 0; i--) {
    if (!player.turns[i].deleted) return player.turns[i].cumulative
  }
  return 0
}

const STORAGE_KEY = '10k-state'

export function createScoreboard() {
  return {
    players: [] as Player[],
    newPlayerName: '',
    currentPlayerIndex: 0,
    turnScore: 0,
    displayTurnScore: 0,
    _scoreTimer: 0,
    lastMessage: '',

    init() {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        try {
          const { players, currentPlayerIndex } = JSON.parse(saved)
          this.players = players
          this.currentPlayerIndex = currentPlayerIndex
        } catch {
          localStorage.removeItem(STORAGE_KEY)
        }
      }
    },

    saveState() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        players: this.players,
        currentPlayerIndex: this.currentPlayerIndex,
      }))
    },

    get currentPlayer(): Player | null {
      return this.players[this.currentPlayerIndex] ?? null
    },

    get winner(): Player | null {
      return this.players.find(p => playerCurrentScore(p) === TARGET_SCORE) ?? null
    },

    get gameStarted(): boolean {
      return this.players.length >= 2
    },

    get gameInProgress(): boolean {
      return this.players.some(p => playerCurrentScore(p) > 0)
    },

    get scoreRows(): (TurnEntry | null)[][] {
      const maxTurns = Math.max(0, ...this.players.map(p => p.turns.length))
      return Array.from({ length: maxTurns }, (_, i) =>
        this.players.map(p => p.turns[i] ?? null)
      )
    },

    cellHtml(entry: TurnEntry | null): string {
      if (!entry) return ''
      const crosses = 'x'.repeat(entry.crosses)
      if (entry.deleted) return `<s>${entry.cumulative}</s>`
      return `${entry.cumulative}${crosses ? ' ' + crosses : ''}`
    },

    // Slot-machine counter animation
    animateScore(target: number) {
      window.clearInterval(this._scoreTimer)
      const steps = 14
      const stepMs = 20
      let step = 0
      const origin = this.displayTurnScore
      const range = Math.abs(target - origin) || 50

      this._scoreTimer = window.setInterval(() => {
        step++
        if (step >= steps) {
          this.displayTurnScore = target
          window.clearInterval(this._scoreTimer)
          this._scoreTimer = 0
        } else {
          const t = step / steps
          const eased = 1 - Math.pow(1 - t, 2)
          const noise = Math.round((Math.random() - 0.5) * range * 0.7 * (1 - t))
          this.displayTurnScore = Math.round(origin + (target - origin) * eased) + noise
        }
      }, stepMs)
    },

    addPlayer() {
      const name = this.newPlayerName.trim()
      if (!name || this.players.some(p => p.name === name)) return
      this.players.push({ id: Date.now(), name, inJail: true, turns: [] })
      this.newPlayerName = ''
      this.saveState()
    },

    removePlayer(id: number) {
      this.players = this.players.filter(p => p.id !== id)
      if (this.currentPlayerIndex >= this.players.length) {
        this.currentPlayerIndex = 0
      }
      this.saveState()
    },

    addCross(player: Player, reason: string) {
      for (let i = player.turns.length - 1; i >= 0; i--) {
        const entry = player.turns[i]
        if (!entry.deleted) {
          entry.crosses++
          if (entry.crosses >= MAX_CROSSES) {
            entry.deleted = true
            const newScore = playerCurrentScore(player)
            if (newScore === 0) {
              player.inJail = true
              this.lastMessage = `${reason} 3 crosses — ${player.name}'s score is deleted! Back to start (in jail).`
            } else {
              this.lastMessage = `${reason} 3 crosses — ${player.name}'s score is deleted! Back to ${newScore}.`
            }
          } else {
            this.lastMessage = `${reason} Turn wasted — ${'x'.repeat(entry.crosses)} for ${player.name}.`
          }
          return
        }
      }
      this.lastMessage = reason
    },

    // BFS cascade: cross every player whose current score matches a newly reached score.
    // The player who just scored (or was just crossed) is excluded from being re-crossed.
    triggerCrossings(newScore: number, scoringPlayer: Player): string[] {
      const messages: string[] = []
      const excluded = new Set<Player>([scoringPlayer])
      const queue: number[] = [newScore]

      while (queue.length > 0) {
        const score = queue.shift()!
        for (const player of this.players) {
          if (excluded.has(player)) continue
          if (playerCurrentScore(player) === score) {
            for (let i = player.turns.length - 1; i >= 0; i--) {
              if (!player.turns[i].deleted) {
                player.turns[i].deleted = true
                excluded.add(player)
                const fallback = playerCurrentScore(player)
                if (fallback === 0) {
                  player.inJail = true
                  messages.push(`${player.name} crossed! Back to jail.`)
                } else {
                  messages.push(`${player.name} crossed! Back to ${fallback}.`)
                  queue.push(fallback)
                }
                break
              }
            }
          }
        }
      }

      return messages
    },

    addToTurn(amount: number) {
      this.turnScore += amount
      this.animateScore(this.turnScore)
    },

    recordTurn() {
      const score = this.turnScore
      if (score < 0 || !this.currentPlayer || this.winner) return

      const player = this.currentPlayer
      this.lastMessage = ''

      if (player.inJail) {
        if (score < JAIL_MINIMUM) {
          this.lastMessage = `${player.name} is in jail — need ${JAIL_MINIMUM}+ to escape. Turn skipped.`
        } else {
          player.inJail = false
          player.turns.push({ cumulative: score, crosses: 0, deleted: false })
          if (score >= 1500) navigator.vibrate?.(150)
          const crossed = this.triggerCrossings(score, player)
          if (crossed.length > 0) this.lastMessage = crossed.join(' ')
        }
      } else {
        const currentScore = playerCurrentScore(player)
        if (score === 0 || currentScore + score > TARGET_SCORE) {
          const reason = score === 0
            ? `${player.name} scored 0.`
            : `Too high! Score would exceed ${TARGET_SCORE}.`
          this.addCross(player, reason)
        } else {
          const newCumulative = currentScore + score
          player.turns.push({ cumulative: newCumulative, crosses: 0, deleted: false })
          if (score >= 1500) navigator.vibrate?.(150)
          const crossed = this.triggerCrossings(newCumulative, player)
          if (crossed.length > 0) this.lastMessage = crossed.join(' ')
        }
      }

      this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length
      this.turnScore = 0
      this.displayTurnScore = 0
      this.saveState()
    },

    resetScores() {
      this.players.forEach(p => {
        p.inJail = true
        p.turns = []
      })
      this.currentPlayerIndex = 0
      this.lastMessage = ''
      this.turnScore = 0
      this.displayTurnScore = 0
      this.saveState()
    },
  }
}
