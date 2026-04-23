export interface TurnEntry {
  cumulative: number
  crosses: number
  deleted: boolean
}

export interface Player {
  id: number
  name: string
  sigil: string
  inJail: boolean
  turns: TurnEntry[]
}

export const TARGET_SCORE = 10_000
export const JAIL_MINIMUM = 500
export const MAX_CROSSES = 3
const SIGILS = ['sun', 'moon', 'hanged', 'skull', 'eye', 'serpent'] as const

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
    gameBegun: false,
    turnScore: 0,
    displayTurnScore: 0,
    _scoreTimer: 0,
    lastMessage: '',

    init() {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          this.players = (parsed.players ?? []).map((p: Player) => ({
            ...p,
            sigil: p.sigil ?? SIGILS[0],
          }))
          this.currentPlayerIndex = parsed.currentPlayerIndex ?? 0
          // Migrate old saves: if any turns were played, auto-resume the game
          this.gameBegun = parsed.gameBegun ?? this.players.some((p: Player) => p.turns.length > 0)
          // Guard against corrupt save
          if (this.gameBegun && this.players.length < 2) this.gameBegun = false
        } catch {
          localStorage.removeItem(STORAGE_KEY)
        }
      }
    },

    saveState() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        players: this.players,
        currentPlayerIndex: this.currentPlayerIndex,
        gameBegun: this.gameBegun,
      }))
    },

    movePlayer(index: number, direction: number) {
      const newIndex = index + direction
      if (newIndex < 0 || newIndex >= this.players.length) return
      const currentId = this.players[this.currentPlayerIndex]?.id
      const [p] = this.players.splice(index, 1)
      this.players.splice(newIndex, 0, p)
      if (currentId != null) {
        this.currentPlayerIndex = this.players.findIndex(x => x.id === currentId)
      }
      this.saveState()
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

    get turnNumber(): number {
      return this.players.reduce((s, p) => s + p.turns.length, 0) + 1
    },

    get scoreRows(): (TurnEntry | null)[][] {
      const maxTurns = Math.max(0, ...this.players.map(p => p.turns.length))
      return Array.from({ length: maxTurns }, (_, i) =>
        this.players.map(p => p.turns[p.turns.length - 1 - i] ?? null)
      )
    },

    get gatheringCaption(): string {
      const words = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight']
      const n = this.players.length
      const w = words[n] ?? String(n)
      return `${w} ${n === 1 ? 'soul has' : 'souls have'} gathered. only one may leave.`
    },

    playerScore(index: number): number {
      const p = this.players[index]
      return p ? playerCurrentScore(p) : 0
    },

    cellHtml(entry: TurnEntry | null): string {
      if (!entry) return ''
      const num = entry.cumulative.toLocaleString()
      if (entry.deleted) {
        return `<span class="cell-stricken">${num}</span>`
      }
      const crosses = entry.crosses > 0
        ? `<span class="cell-crosses">${'✕'.repeat(entry.crosses)}</span>`
        : ''
      return `<span class="cell-score">${num}</span>${crosses}`
    },

    // Slot-machine counter animation — do not modify
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
      this.players.push({
        id: Date.now(),
        name,
        sigil: SIGILS[this.players.length % SIGILS.length],
        inJail: true,
        turns: [],
      })
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

    beginGame() {
      if (!this.gameStarted) return
      this.gameBegun = true
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
            this.lastMessage = `${reason} Turn wasted — ${'✕'.repeat(entry.crosses)} for ${player.name}.`
          }
          return
        }
      }
      this.lastMessage = reason
    },

    // BFS cascade: cross every player whose current score matches a newly reached score.
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
      this.gameBegun = false
      this.saveState()
    },
  }
}
