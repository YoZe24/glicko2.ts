/**
 * Example demonstrating fractional rating periods for chess puzzle applications
 * Run with: npx ts-node examples/puzzle-rating-example.ts
 */

import { 
  Glicko2, 
  PuzzleRatingManager, 
  Player, 
  PlayerRatingState 
} from '../src/index'

// Example 1: Traditional vs Fractional Comparison
function demonstrateTraditionalVsFractional() {
  console.log('=== Traditional vs Fractional Glicko-2 ===\n')

  // Traditional Glicko-2 (unchanged behavior)
  const traditional = new Glicko2({
    enableFractionalPeriods: false
  })

  // Fractional Glicko-2 (new instant updates)
  const fractional = new Glicko2({
    enableFractionalPeriods: true,
    ratingPeriodDays: 1.0
  })

  const player1 = traditional.makePlayer(1500, 100, 0.06)
  const player2 = fractional.makePlayer(1500, 100, 0.06)

  console.log('Initial ratings:')
  console.log(`Traditional player: ${player1.getRating().toFixed(0)} (RD: ${player1.getRd().toFixed(1)})`)
  console.log(`Fractional player:  ${player2.getRating().toFixed(0)} (RD: ${player2.getRd().toFixed(1)})`)

  // Traditional batch update
  const opponent1 = traditional.makePlayer(1600, 50, 0.06)
  traditional.updateRatings([[player1, opponent1, 1]]) // Win

  // Fractional instant update
  const result = fractional.updateRatingInstant(player2, 1600, 50, 1) // Win

  console.log('\nAfter winning against 1600-rated opponent:')
  console.log(`Traditional player: ${player1.getRating().toFixed(0)} (RD: ${player1.getRd().toFixed(1)})`)
  console.log(`Fractional player:  ${result.rating.toFixed(0)} (RD: ${result.rd.toFixed(1)})`)
  console.log(`Update timestamp:   ${new Date(result.lastUpdateTime).toLocaleTimeString()}\n`)
}

// Example 2: Puzzle Rating System
function demonstratePuzzleRating() {
  console.log('=== Chess Puzzle Rating System ===\n')

  const puzzleManager = new PuzzleRatingManager({
    tau: 0.75, // Higher volatility for puzzles
    ratingPeriodDays: 1.0
  })

  const player = puzzleManager.makePlayer(1200, 150, 0.06)
  console.log(`Starting puzzle rating: ${player.getRating().toFixed(0)}`)
  console.log(`Starting RD: ${player.getRd().toFixed(1)}\n`)

  // Simulate a puzzle session
  const puzzles = [
    { difficulty: 1180, solved: true, description: 'Easy tactical puzzle' },
    { difficulty: 1220, solved: true, description: 'Medium endgame puzzle' },
    { difficulty: 1300, solved: false, description: 'Hard combination puzzle' },
    { difficulty: 1200, solved: true, description: 'Pattern recognition puzzle' },
    { difficulty: 1350, solved: true, description: 'Advanced tactical puzzle' }
  ]

  console.log('Puzzle session:')
  let sessionTime = Date.now()
  let previousRating = 1200
  let ratingHistory: number[] = []

  puzzles.forEach((puzzle, index) => {
    // Simulate time between puzzles
    sessionTime += Math.random() * 5 * 60 * 1000 // 0-5 minutes

    const result = puzzleManager.processPuzzleAttempt(
      player,
      puzzle.difficulty,
      puzzle.solved,
      sessionTime
    )

    const ratingChange = result.rating - previousRating
    ratingHistory.push(result.rating)

    console.log(`${index + 1}. ${puzzle.description} (${puzzle.difficulty})`)
    console.log(`   ${puzzle.solved ? '✓ SOLVED' : '✗ FAILED'} - Rating: ${result.rating.toFixed(0)} (${ratingChange >= 0 ? '+' : ''}${ratingChange.toFixed(0)})`)
    
    previousRating = result.rating
  })

  console.log(`\nFinal rating: ${player.getRating().toFixed(0)}`)
  console.log(`Session rating change: ${(player.getRating() - 1200).toFixed(0)}`)
  console.log(`Current RD: ${player.getRd().toFixed(1)}\n`)
}

// Example 3: Advanced Puzzle Features
function demonstrateAdvancedFeatures() {
  console.log('=== Advanced Puzzle Features ===\n')

  const puzzleManager = new PuzzleRatingManager()
  const player = puzzleManager.makePlayer(1400, 80, 0.06)

  console.log(`Player rating: ${player.getRating().toFixed(0)}\n`)

  // Advanced puzzle attempts with time and hints
  const attempts = [
    {
      difficulty: 1450,
      solved: true,
      timeSpent: 22000, // 22 seconds (fast bonus)
      hintsUsed: 0,
      description: 'Quick tactical solve'
    },
    {
      difficulty: 1400,
      solved: true,
      timeSpent: 180000, // 3 minutes (normal)
      hintsUsed: 1, // One hint penalty
      description: 'Needed one hint'
    },
    {
      difficulty: 1500,
      solved: true,
      timeSpent: 600000, // 10 minutes (slow penalty)
      hintsUsed: 2, // Two hint penalty
      description: 'Difficult, took hints and time'
    }
  ]

  console.log('Advanced puzzle attempts:')
  attempts.forEach((attempt, index) => {
    const initialRating = player.getRating()
    const result = puzzleManager.processPuzzleAttemptAdvanced(player, attempt)
    const change = result.rating - initialRating

    console.log(`${index + 1}. ${attempt.description}`)
    console.log(`   Difficulty: ${attempt.difficulty}, Time: ${(attempt.timeSpent / 1000).toFixed(0)}s, Hints: ${attempt.hintsUsed}`)
    console.log(`   Rating change: ${change >= 0 ? '+' : ''}${change.toFixed(1)} → ${result.rating.toFixed(0)}`)
  })

  // Puzzle recommendation system
  console.log('\n--- Puzzle Recommendations ---')
  const difficulties = [0.5, 0.7, 0.8, 0.9]
  
  difficulties.forEach(targetRate => {
    const suggestedDifficulty = puzzleManager.suggestPuzzleDifficulty(player, targetRate)
    console.log(`For ${(targetRate * 100).toFixed(0)}% success rate: ${suggestedDifficulty} difficulty`)
  })

  // Expected scores for different difficulties
  console.log('\n--- Expected Success Rates ---')
  const testDifficulties = [1200, 1300, 1400, 1500, 1600]
  
  testDifficulties.forEach(difficulty => {
    const expectedScore = puzzleManager.calculateExpectedScore(
      player.getRating(),
      difficulty,
      player.getRd()
    )
    console.log(`vs ${difficulty} difficulty: ${(expectedScore * 100).toFixed(1)}% expected success`)
  })

  console.log()
}

// Example 4: Time-Based Rating Decay
function demonstrateTimeBasedDecay() {
  console.log('=== Time-Based Rating Decay ===\n')

  const glicko = new Glicko2({
    enableFractionalPeriods: true,
    ratingPeriodDays: 2.0 // 2-day periods
  })

  const player = glicko.makePlayer(1500, 50, 0.06)
  const now = Date.now()

  console.log(`Initial state:`)
  console.log(`Rating: ${player.getRating().toFixed(0)}, RD: ${player.getRd().toFixed(1)}`)
  console.log(`Last update: ${new Date(player.getLastUpdateTime()).toLocaleString()}\n`)

  // Simulate different time intervals
  const timeIntervals = [
    { hours: 12, description: '12 hours later' },
    { hours: 24, description: '1 day later' },
    { hours: 48, description: '2 days later (1 full period)' },
    { hours: 168, description: '1 week later' }
  ]

  timeIntervals.forEach(interval => {
    const futureTime = now + (interval.hours * 60 * 60 * 1000)
    const futureState = player.getCurrentRating(futureTime)
    
    console.log(`${interval.description}:`)
    console.log(`Rating: ${futureState.rating.toFixed(0)} (unchanged)`)
    console.log(`RD: ${futureState.rd.toFixed(1)} (increased by ${(futureState.rd - 50).toFixed(2)})`)
    console.log()
  })

  console.log('Note: Rating stays the same, but RD (uncertainty) increases over time\n')
}

// Example 5: Complete Chess App Simulation
function simulateChessApp() {
  console.log('=== Complete Chess Puzzle App Simulation ===\n')

  const puzzleManager = new PuzzleRatingManager()
  
  // Create three players with different starting levels
  const players = {
    beginner: puzzleManager.makePlayer(1000, 200, 0.06),
    intermediate: puzzleManager.makePlayer(1400, 100, 0.06),
    advanced: puzzleManager.makePlayer(1800, 80, 0.06)
  }

  console.log('Initial ratings:')
  Object.entries(players).forEach(([level, player]) => {
    console.log(`${level.padEnd(12)}: ${player.getRating().toFixed(0)}`)
  })
  console.log()

  // Simulate each player solving puzzles at their level
  Object.entries(players).forEach(([level, player]) => {
    console.log(`--- ${level.toUpperCase()} PLAYER SESSION ---`)
    
    const baseRating = player.getRating()
    const puzzleCount = 5
    let sessionTime = Date.now()

    for (let i = 0; i < puzzleCount; i++) {
      // Get recommended puzzle difficulty
      const targetSuccessRate = 0.7 + (Math.random() * 0.2) // 70-90%
      const puzzleDifficulty = puzzleManager.suggestPuzzleDifficulty(player, targetSuccessRate)
      
      // Simulate solving attempt
      const expectedSuccess = puzzleManager.calculateExpectedScore(
        player.getRating(),
        puzzleDifficulty,
        player.getRd()
      )
      
      const solved = Math.random() < expectedSuccess
      const timeSpent = 20000 + Math.random() * 120000 // 20s to 2min
      const hintsUsed = solved ? 0 : Math.floor(Math.random() * 2) // 0-1 hints if failed
      
      sessionTime += timeSpent + Math.random() * 30000 // Plus thinking time

      const result = puzzleManager.processPuzzleAttemptAdvanced(player, {
        difficulty: puzzleDifficulty,
        solved,
        timeSpent,
        hintsUsed
      }, sessionTime)

      console.log(`Puzzle ${i + 1}: ${puzzleDifficulty} ${solved ? '✓' : '✗'} → ${result.rating.toFixed(0)}`)
    }

    const sessionChange = player.getRating() - baseRating
    console.log(`Session result: ${sessionChange >= 0 ? '+' : ''}${sessionChange.toFixed(0)} points\n`)
  })

  console.log('Final ratings:')
  Object.entries(players).forEach(([level, player]) => {
    console.log(`${level.padEnd(12)}: ${player.getRating().toFixed(0)} (RD: ${player.getRd().toFixed(1)})`)
  })
}

// Run all examples
function runAllExamples() {
  console.log('🚀 Glicko-2 Fractional Rating Examples\n')
  console.log('=' .repeat(50))
  
  demonstrateTraditionalVsFractional()
  console.log('=' .repeat(50))
  
  demonstratePuzzleRating()
  console.log('=' .repeat(50))
  
  demonstrateAdvancedFeatures()
  console.log('=' .repeat(50))
  
  demonstrateTimeBasedDecay()
  console.log('=' .repeat(50))
  
  simulateChessApp()
  console.log('=' .repeat(50))
  
  console.log('✅ All examples completed successfully!')
}

// Export for usage or run directly
if (require.main === module) {
  runAllExamples()
} else {
  module.exports = {
    demonstrateTraditionalVsFractional,
    demonstratePuzzleRating,
    demonstrateAdvancedFeatures,
    demonstrateTimeBasedDecay,
    simulateChessApp,
    runAllExamples
  }
}
