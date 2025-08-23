import { 
	Glicko2, 
	FractionalPeriodCalculator, 
	PuzzleRatingManager, 
	Player,
	PlayerRatingState
} from '../src/index'

describe('Fractional Rating System', () => {
	describe('FractionalPeriodCalculator', () => {
		let calculator: FractionalPeriodCalculator

		beforeEach(() => {
			calculator = new FractionalPeriodCalculator(1.0) // 1 day period for easier testing
		})

		test('should calculate elapsed periods correctly', () => {
			const now = Date.now()
			const oneDayAgo = now - (24 * 60 * 60 * 1000)
			const halfDayAgo = now - (12 * 60 * 60 * 1000)

			expect(calculator.calculateElapsedPeriods(oneDayAgo, now)).toBeCloseTo(1.0, 2)
			expect(calculator.calculateElapsedPeriods(halfDayAgo, now)).toBeCloseTo(0.5, 2)
			expect(calculator.calculateElapsedPeriods(now, now)).toBe(0)
		})

		test('should calculate new RD correctly', () => {
			const currentRd = 50
			const volatility = 0.06
			const elapsedPeriods = 0.5

			const newRd = calculator.calculateNewRd(currentRd, volatility, elapsedPeriods)
			const expected = Math.sqrt(Math.pow(currentRd, 2) + elapsedPeriods * Math.pow(volatility, 2))
			
			expect(newRd).toBeCloseTo(expected, 6)
		})

		test('should not allow negative elapsed periods', () => {
			const future = Date.now() + 10000
			const now = Date.now()
			
			expect(calculator.calculateElapsedPeriods(future, now)).toBe(0)
		})
	})

	describe('Enhanced Glicko2 with Fractional Periods', () => {
		let glicko: Glicko2
		let player: Player

		beforeEach(() => {
			glicko = new Glicko2({
				enableFractionalPeriods: true,
				ratingPeriodDays: 1.0
			})
			player = glicko.makePlayer(1500, 100, 0.06)
		})

		test('should enable fractional periods when configured', () => {
			expect(glicko.isFractionalPeriodsEnabled()).toBe(true)
			expect(glicko.getPeriodCalculator()).toBeDefined()
		})

		test('should assign fractional calculator to new players', () => {
			const testPlayer = glicko.makePlayer()
			expect(testPlayer.getCurrentRating()).toBeDefined()
			
			// Player should have time tracking capabilities
			expect(testPlayer.getLastUpdateTime()).toBeGreaterThan(0)
		})

		test('should update ratings instantly', () => {
			const initialRating = player.getRating()
			const result = glicko.updateRatingInstant(player, 1600, 50, 1) // Win against stronger opponent

			expect(result.rating).toBeGreaterThan(initialRating)
			expect(result.lastUpdateTime).toBeDefined()
		})

		test('should apply time-based RD decay', async () => {
			const initialState = player.getCurrentRating()
			
			// Simulate some time passing
			const futureTime = Date.now() + (12 * 60 * 60 * 1000) // 12 hours later
			const futureState = player.getCurrentRating(futureTime)
			
			expect(futureState.rd).toBeGreaterThan(initialState.rd)
		})

		test('should maintain backward compatibility when disabled', () => {
			const traditionalGlicko = new Glicko2({
				enableFractionalPeriods: false
			})
			
			expect(traditionalGlicko.isFractionalPeriodsEnabled()).toBe(false)
			expect(traditionalGlicko.getPeriodCalculator()).toBeUndefined()
			
			const player1 = traditionalGlicko.makePlayer(1400, 30, 0.06)
			const player2 = traditionalGlicko.makePlayer(1550, 100, 0.06)
			
			// Traditional batch update should still work
			traditionalGlicko.updateRatings([[player1, player2, 1]])
			
			expect(player1.getRating()).toBeGreaterThan(1400)
		})
	})

	describe('PuzzleRatingManager', () => {
		let puzzleManager: PuzzleRatingManager
		let player: Player

		beforeEach(() => {
			puzzleManager = new PuzzleRatingManager()
			player = puzzleManager.makePlayer(1200, 100, 0.06)
		})

		test('should be initialized with puzzle-optimized defaults', () => {
			expect(puzzleManager.isFractionalPeriodsEnabled()).toBe(true)
		})

		test('should process simple puzzle attempts', () => {
			const initialRating = player.getRating()
			
			// Solve a puzzle at current difficulty level
			const result = puzzleManager.processPuzzleAttempt(player, 1200, true)
			
			expect(result.rating).toBeGreaterThan(initialRating)
			expect(result.lastUpdateTime).toBeDefined()
		})

		test('should process advanced puzzle attempts with time and hints', () => {
			const initialRating = player.getRating()
			
			const attempt = {
				difficulty: 1300,
				solved: true,
				timeSpent: 25000, // 25 seconds (fast solve bonus)
				hintsUsed: 0
			}
			
			const result = puzzleManager.processPuzzleAttemptAdvanced(player, attempt)
			
			expect(result.rating).toBeGreaterThan(initialRating)
		})

		test('should apply penalties for hints and slow solving', () => {
			const player1 = puzzleManager.makePlayer(1200, 100, 0.06)
			const player2 = puzzleManager.makePlayer(1200, 100, 0.06)
			
			// Player 1: Quick solve, no hints
			const attempt1 = {
				difficulty: 1300,
				solved: true,
				timeSpent: 20000,
				hintsUsed: 0
			}
			
			// Player 2: Slow solve with hints
			const attempt2 = {
				difficulty: 1300,
				solved: true,
				timeSpent: 400000, // Very slow
				hintsUsed: 2
			}
			
			const result1 = puzzleManager.processPuzzleAttemptAdvanced(player1, attempt1)
			const result2 = puzzleManager.processPuzzleAttemptAdvanced(player2, attempt2)
			
			expect(result1.rating).toBeGreaterThan(result2.rating)
		})

		test('should calculate expected scores correctly', () => {
			const expectedScore = puzzleManager.calculateExpectedScore(1500, 1500, 50)
			expect(expectedScore).toBeCloseTo(0.5, 1) // Equal ratings should give ~50% chance
			
			const higherScore = puzzleManager.calculateExpectedScore(1600, 1500, 50)
			expect(higherScore).toBeGreaterThan(0.5) // Higher rating should give better chance
		})

		test('should suggest appropriate puzzle difficulties', () => {
			// Create a player with known rating
			const testPlayer = puzzleManager.makePlayer(1500, 50, 0.06)
			
			const suggestedDifficulty = puzzleManager.suggestPuzzleDifficulty(testPlayer, 0.7)
			
			// Should suggest something easier than player's rating for 70% success rate
			expect(suggestedDifficulty).toBeLessThan(1500)
			expect(suggestedDifficulty).toBeGreaterThan(1300)
		})

		test('should handle batch puzzle processing', () => {
			const attempts = [
				{ difficulty: 1200, solved: true, timeSpent: 30000, hintsUsed: 0 },
				{ difficulty: 1250, solved: false, timeSpent: 60000, hintsUsed: 1 },
				{ difficulty: 1180, solved: true, timeSpent: 20000, hintsUsed: 0 }
			]
			
			const initialRating = player.getRating()
			const finalState = puzzleManager.processPuzzleAttempts(player, attempts)
			
			expect(finalState.rating).toBeDefined()
			expect(finalState.lastUpdateTime).toBeDefined()
			
			// Player should have gained some rating (2 wins vs 1 loss)
			expect(finalState.rating).toBeGreaterThan(initialRating - 50)
		})
	})

	describe('Player Clone and Time Tracking', () => {
		let glicko: Glicko2
		let player: Player

		beforeEach(() => {
			glicko = new Glicko2({ enableFractionalPeriods: true })
			player = glicko.makePlayer(1500, 100, 0.06)
		})

		test('should clone players correctly', () => {
			// Add some match history
			player.adv_ranks = [0.1, 0.2]
			player.adv_rds = [0.05, 0.08]
			player.outcomes = [1, 0]
			
			const clone = player.clone()
			
			expect(clone.getRating()).toBe(player.getRating())
			expect(clone.getRd()).toBe(player.getRd())
			expect(clone.getVol()).toBe(player.getVol())
			expect(clone.getLastUpdateTime()).toBe(player.getLastUpdateTime())
			expect(clone.adv_ranks).toEqual(player.adv_ranks)
			expect(clone.outcomes).toEqual(player.outcomes)
			
			// But should be separate instances
			expect(clone).not.toBe(player)
		})

		test('should track update times correctly', () => {
			const now = Date.now()
			player.setLastUpdateTime(now)
			
			expect(player.getLastUpdateTime()).toBe(now)
		})
	})

	describe('Integration Test: Complete Puzzle Session', () => {
		test('should simulate a complete puzzle solving session', () => {
			const puzzleManager = new PuzzleRatingManager({
				tau: 0.75,
				ratingPeriodDays: 0.5 // Half day periods for faster testing
			})
			
			const player = puzzleManager.makePlayer(1200, 150, 0.06)
			const sessionStart = Date.now()
			
			// Simulate puzzle session over time
			const puzzles = [
				{ difficulty: 1180, solved: true, delay: 0 },
				{ difficulty: 1220, solved: true, delay: 5 * 60 * 1000 }, // 5 min later
				{ difficulty: 1250, solved: false, delay: 3 * 60 * 1000 }, // 3 min later
				{ difficulty: 1200, solved: true, delay: 4 * 60 * 1000 }, // 4 min later
				{ difficulty: 1280, solved: true, delay: 6 * 60 * 1000 }  // 6 min later
			]
			
			let currentTime = sessionStart
			const results: PlayerRatingState[] = []
			
			for (const puzzle of puzzles) {
				currentTime += puzzle.delay
				const result = puzzleManager.processPuzzleAttempt(
					player,
					puzzle.difficulty,
					puzzle.solved,
					currentTime
				)
				results.push(result)
			}
			
			// Player should have improved overall (4 wins, 1 loss)
			expect(results[results.length - 1].rating).toBeGreaterThan(1200)
			
			// RD should have changed due to time decay
			const finalState = player.getCurrentRating(currentTime + 60 * 60 * 1000) // 1 hour later
			expect(finalState.rd).toBeGreaterThan(results[results.length - 1].rd)
			
			// Verify all results have proper timestamps
			results.forEach(result => {
				expect(result.lastUpdateTime).toBeGreaterThanOrEqual(sessionStart)
			})
		})
	})
})
