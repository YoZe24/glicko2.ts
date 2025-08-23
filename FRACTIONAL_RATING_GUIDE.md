# Fractional Rating Guide

This guide explains how to use the new fractional rating periods feature in glicko2.ts, enabling instant rating updates perfect for chess puzzle applications.

## Overview

The fractional rating system extends the traditional Glicko-2 algorithm to support instant rating updates instead of waiting for full rating periods. This is particularly useful for:

- Chess puzzle applications
- Real-time rating updates
- Any scenario requiring immediate feedback

## Key Features

- **Instant Rating Updates**: No need to wait for rating periods
- **Time-Based RD Decay**: Rating Deviation increases realistically over time
- **Backward Compatible**: Existing code continues to work unchanged
- **Puzzle-Optimized**: Specialized `PuzzleRatingManager` for chess puzzles

## Basic Usage

### Traditional Glicko-2 (Unchanged)

```typescript
import { Glicko2 } from 'glicko2.ts'

// Traditional usage still works exactly the same
const glicko = new Glicko2({
  tau: 0.5,
  rating: 1500,
  rd: 200,
  vol: 0.06
})

const player1 = glicko.makePlayer(1400, 30, 0.06)
const player2 = glicko.makePlayer(1550, 100, 0.06)

// Batch processing
glicko.updateRatings([[player1, player2, 1]])
```

### Fractional Rating Periods

```typescript
import { Glicko2 } from 'glicko2.ts'

// Enable fractional periods
const glicko = new Glicko2({
  tau: 0.5,
  rating: 1500,
  rd: 200,
  vol: 0.06,
  enableFractionalPeriods: true,
  ratingPeriodDays: 4.6 // Lichess-style periods
})

const player = glicko.makePlayer(1200, 100, 0.06)

// Instant rating update
const result = glicko.updateRatingInstant(
  player,
  1400, // opponent rating
  50,   // opponent RD
  1     // outcome (1 = win, 0 = loss, 0.5 = draw)
)

console.log(`New rating: ${result.rating}`)
console.log(`New RD: ${result.rd}`)
```

## Puzzle Rating Manager

For chess puzzle applications, use the specialized `PuzzleRatingManager`:

```typescript
import { PuzzleRatingManager } from 'glicko2.ts'

// Puzzle-optimized configuration
const puzzleRating = new PuzzleRatingManager({
  tau: 0.75,              // Higher volatility for puzzles
  ratingPeriodDays: 1.0,  // Daily periods
  // enableFractionalPeriods: true (enabled by default)
})

const player = puzzleRating.makePlayer(1200, 100, 0.06)

// Simple puzzle attempt
const result = puzzleRating.processPuzzleAttempt(
  player,
  1400, // puzzle difficulty
  true  // solved
)

console.log(`Rating after puzzle: ${result.rating}`)
```

### Advanced Puzzle Features

```typescript
// Advanced puzzle attempt with time and hint tracking
const attempt = {
  difficulty: 1350,
  solved: true,
  timeSpent: 25000,  // 25 seconds (fast solve bonus)
  hintsUsed: 0       // no hints used
}

const result = puzzleRating.processPuzzleAttemptAdvanced(player, attempt)

// Batch process multiple puzzles
const puzzleSession = [
  { difficulty: 1200, solved: true, timeSpent: 30000, hintsUsed: 0 },
  { difficulty: 1250, solved: false, timeSpent: 120000, hintsUsed: 2 },
  { difficulty: 1180, solved: true, timeSpent: 20000, hintsUsed: 0 }
]

const finalState = puzzleRating.processPuzzleAttempts(player, puzzleSession)
```

### Puzzle Recommendation System

```typescript
// Get puzzle recommendation for 70% success rate
const suggestedDifficulty = puzzleRating.suggestPuzzleDifficulty(player, 0.7)
console.log(`Suggested puzzle difficulty: ${suggestedDifficulty}`)

// Calculate expected success rate
const expectedScore = puzzleRating.calculateExpectedScore(
  player.getRating(),
  1400, // puzzle difficulty
  player.getRd()
)
console.log(`Expected success rate: ${(expectedScore * 100).toFixed(1)}%`)
```

## Time-Based Features

### Rating Deviation Decay

```typescript
// Get current rating with time-based RD adjustment
const currentState = player.getCurrentRating()
console.log(`Current RD: ${currentState.rd}`)

// Get rating state one day in the future
const futureTime = Date.now() + (24 * 60 * 60 * 1000)
const futureState = player.getCurrentRating(futureTime)
console.log(`RD after one day: ${futureState.rd}`) // Will be higher
```

### Manual Time Updates

```typescript
// Apply time-based RD decay manually
player.updateRdForTimeElapsed() // Uses current time
// or
player.updateRdForTimeElapsed(specificTimestamp)

// Check last update time
console.log(`Last updated: ${new Date(player.getLastUpdateTime())}`)
```

## Configuration Options

### Glicko2Options Interface

```typescript
interface Glicko2Options {
  tau: number                    // System constant (default: 0.5)
  rating: number                 // Base rating (default: 1500)
  rd: number                     // Base rating deviation (default: 350)
  vol: number                    // Base volatility (default: 0.06)
  volatilityAlgorithm: Function  // Volatility calculation method
  ratingPeriodDays: number       // Period duration in days (default: 4.6)
  enableFractionalPeriods: boolean // Enable instant updates (default: false)
}
```

### Recommended Configurations

#### For Chess Puzzles
```typescript
const puzzleConfig = {
  tau: 0.75,                     // Higher volatility
  rating: 1500,
  rd: 350,
  vol: 0.06,
  ratingPeriodDays: 1.0,         // Daily periods
  enableFractionalPeriods: true
}
```

#### For Real-time Games
```typescript
const realtimeConfig = {
  tau: 0.5,
  rating: 1500,
  rd: 200,
  vol: 0.06,
  ratingPeriodDays: 0.5,         // 12-hour periods
  enableFractionalPeriods: true
}
```

## Performance Considerations

- **Memory**: Minimal overhead (one timestamp per player)
- **CPU**: O(1) time complexity for RD updates
- **Compatibility**: 100% backward compatible

## Migration Guide

### From Traditional Glicko-2

1. **No changes required** for existing code when `enableFractionalPeriods: false`
2. **Add instant updates** by setting `enableFractionalPeriods: true`
3. **Use instant methods** like `updateRatingInstant()` for immediate feedback

### Example Migration

```typescript
// Before (traditional)
const glicko = new Glicko2()
const matches = [[player1, player2, 1]]
glicko.updateRatings(matches)

// After (with instant updates)
const glicko = new Glicko2({ enableFractionalPeriods: true })
const result = glicko.updateRatingInstant(player1, player2.getRating(), player2.getRd(), 1)
```

## Real-World Example: Chess Puzzle App

```typescript
import { PuzzleRatingManager } from 'glicko2.ts'

class ChessPuzzleApp {
  private puzzleRating = new PuzzleRatingManager()
  private players = new Map<string, Player>()

  // Initialize new player
  createPlayer(userId: string, initialRating = 1200): Player {
    const player = this.puzzleRating.makePlayer(initialRating, 150, 0.06)
    this.players.set(userId, player)
    return player
  }

  // Process puzzle attempt
  async solvePuzzle(userId: string, puzzleId: string, solved: boolean, timeSpent: number) {
    const player = this.players.get(userId)
    if (!player) throw new Error('Player not found')

    const puzzle = await this.getPuzzleById(puzzleId)
    
    const result = this.puzzleRating.processPuzzleAttemptAdvanced(player, {
      difficulty: puzzle.difficulty,
      solved,
      timeSpent,
      hintsUsed: puzzle.hintsUsed || 0
    })

    // Save updated rating to database
    await this.savePlayerRating(userId, result)
    
    return {
      newRating: Math.round(result.rating),
      ratingChange: Math.round(result.rating - player.getRating()),
      confidence: Math.round(100 / result.rd) // Inverse of RD as confidence
    }
  }

  // Get next puzzle recommendation
  getRecommendedPuzzle(userId: string, targetSuccessRate = 0.75) {
    const player = this.players.get(userId)
    if (!player) throw new Error('Player not found')

    const difficulty = this.puzzleRating.suggestPuzzleDifficulty(player, targetSuccessRate)
    return this.findPuzzleByDifficulty(difficulty)
  }

  // Additional methods...
  private async getPuzzleById(puzzleId: string) { /* ... */ }
  private async savePlayerRating(userId: string, rating: PlayerRatingState) { /* ... */ }
  private findPuzzleByDifficulty(difficulty: number) { /* ... */ }
}
```

## Mathematical Background

### Fractional Period Formula

The core formula for time-based RD updates is:

```
newRD = √(oldRD² + elapsedPeriods × volatility²)
```

Where:
- `elapsedPeriods` = elapsed time / rating period duration
- Can be fractional (e.g., 0.5 for half a period)

### Example Calculation

```typescript
// Player with RD=50, volatility=0.06, half day elapsed (0.5 periods)
const newRD = Math.sqrt(50² + 0.5 × 0.06²)
// newRD ≈ 50.0018 (minimal increase for short time)

// Same player after 10 days (10 periods)
const newRD = Math.sqrt(50² + 10 × 0.06²)
// newRD ≈ 50.036 (noticeable increase)
```

This provides realistic rating confidence decay over time while maintaining mathematical precision.
