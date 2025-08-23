import { Glicko2, Glicko2Options } from './glicko2'
import { Player, PlayerRatingState } from './player'

/**
 * Interface for puzzle attempt data
 */
export interface PuzzleAttempt {
	difficulty: number
	solved: boolean
	timeSpent?: number // milliseconds
	hintsUsed?: number
}

/**
 * Specialized Glicko2 implementation optimized for chess puzzle rating
 * Features instant rating updates with fractional periods enabled by default
 */
export class PuzzleRatingManager extends Glicko2 {
	constructor(options: Partial<Glicko2Options> = {}) {
		// Puzzle-optimized defaults
		const puzzleDefaults: Partial<Glicko2Options> = {
			tau: 0.75, // Higher volatility for puzzles
			rating: 1500,
			rd: 350,
			vol: 0.06,
			ratingPeriodDays: 1.0, // Shorter periods for more frequent updates
			enableFractionalPeriods: true // Enable instant updates by default
		}

		super({ ...puzzleDefaults, ...options })
	}

	/**
	 * Process a single puzzle attempt with instant rating update
	 * @param player The player attempting the puzzle
	 * @param puzzleDifficulty The difficulty rating of the puzzle
	 * @param solved Whether the puzzle was solved
	 * @param attemptTime When the attempt occurred (defaults to current time)
	 * @returns Updated player rating state
	 */
	processPuzzleAttempt(
		player: Player,
		puzzleDifficulty: number,
		solved: boolean,
		attemptTime: number = Date.now()
	): PlayerRatingState {
		// Puzzles have lower RD since difficulty is more "known"
		const puzzleRD = 50
		const outcome = solved ? 1 : 0

		return this.updateRatingInstant(
			player,
			puzzleDifficulty,
			puzzleRD,
			outcome,
			attemptTime
		)
	}

	/**
	 * Process a puzzle attempt with advanced performance factors
	 * @param player The player attempting the puzzle
	 * @param attempt Detailed puzzle attempt data
	 * @param attemptTime When the attempt occurred (defaults to current time)
	 * @returns Updated player rating state
	 */
	processPuzzleAttemptAdvanced(
		player: Player,
		attempt: PuzzleAttempt,
		attemptTime: number = Date.now()
	): PlayerRatingState {
		// Start with base outcome
		let adjustedOutcome = attempt.solved ? 1 : 0

		// Apply time bonus/penalty if time data is available
		if (attempt.timeSpent !== undefined && attempt.solved) {
			// Small bonus for solving quickly (under 30 seconds)
			if (attempt.timeSpent < 30000) {
				adjustedOutcome = Math.min(1.0, adjustedOutcome + 0.1)
			}
			// Small penalty for taking very long (over 5 minutes)
			else if (attempt.timeSpent > 300000) {
				adjustedOutcome = Math.max(0, adjustedOutcome - 0.05)
			}
		}

		// Apply hint penalty if hint data is available
		if (attempt.hintsUsed !== undefined && attempt.hintsUsed > 0) {
			adjustedOutcome = Math.max(0, adjustedOutcome - (attempt.hintsUsed * 0.1))
		}

		// Adjust puzzle RD based on uncertainty factors
		let puzzleRD = 50
		if (attempt.hintsUsed !== undefined) {
			puzzleRD += attempt.hintsUsed * 10 // Higher uncertainty with hints
		}

		return this.updateRatingInstant(
			player,
			attempt.difficulty,
			puzzleRD,
			adjustedOutcome,
			attemptTime
		)
	}

	/**
	 * Batch process multiple puzzle attempts for a player
	 * @param player The player
	 * @param attempts Array of puzzle attempts
	 * @returns Final player rating state after all attempts
	 */
	processPuzzleAttempts(
		player: Player,
		attempts: (PuzzleAttempt & { attemptTime?: number })[]
	): PlayerRatingState {
		let finalState: PlayerRatingState

		for (const attempt of attempts) {
			const attemptTime = attempt.attemptTime || Date.now()
			finalState = this.processPuzzleAttemptAdvanced(
				player,
				attempt,
				attemptTime
			)
		}

		return finalState!
	}

	/**
	 * Calculate expected score against a puzzle of given difficulty
	 * @param playerRating Current player rating
	 * @param puzzleDifficulty Puzzle difficulty rating
	 * @param playerRD Player's rating deviation (default: 50)
	 * @returns Expected score (0-1)
	 */
	calculateExpectedScore(
		playerRating: number,
		puzzleDifficulty: number,
		playerRD: number = 50
	): number {
		// Use simplified Glicko expected score formula
		const ratingDiff = playerRating - puzzleDifficulty
		const q = Math.LN10 / 400
		const g = 1 / Math.sqrt(1 + (3 * Math.pow(q * playerRD, 2)) / Math.pow(Math.PI, 2))
		
		return 1 / (1 + Math.pow(10, (-g * ratingDiff) / 400))
	}

	/**
	 * Suggest puzzle difficulty based on player's current rating
	 * @param player The player
	 * @param targetSuccessRate Desired success rate (default: 0.7)
	 * @returns Suggested puzzle difficulty
	 */
	suggestPuzzleDifficulty(
		player: Player,
		targetSuccessRate: number = 0.7
	): number {
		const currentRating = player.getCurrentRating()
		
		// Use binary search to find difficulty that gives target success rate
		let low = currentRating.rating - 500
		let high = currentRating.rating + 500
		
		for (let i = 0; i < 20; i++) { // 20 iterations should be enough precision
			const mid = (low + high) / 2
			const expectedScore = this.calculateExpectedScore(
				currentRating.rating,
				mid,
				currentRating.rd
			)
			
			if (Math.abs(expectedScore - targetSuccessRate) < 0.01) {
				return Math.round(mid)
			}
			
			if (expectedScore > targetSuccessRate) {
				low = mid
			} else {
				high = mid
			}
		}
		
		return Math.round((low + high) / 2)
	}
}
