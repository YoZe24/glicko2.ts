/**
 * Calculator for fractional rating periods enabling instant rating updates
 * Implements the Lichess approach for time-based rating deviation adjustments
 */
export class FractionalPeriodCalculator {
	private readonly ratingPeriodMs: number

	/**
	 * Creates a new fractional period calculator
	 * @param ratingPeriodDays Duration of a full rating period in days (default: 4.6 days, Lichess value)
	 */
	constructor(ratingPeriodDays: number = 4.6) {
		this.ratingPeriodMs = ratingPeriodDays * 24 * 60 * 60 * 1000
	}

	/**
	 * Calculates elapsed rating periods as a fractional value
	 * @param lastUpdateTime Unix timestamp in milliseconds of last update
	 * @param currentTime Unix timestamp in milliseconds of current time
	 * @returns Fractional number of rating periods elapsed (e.g., 0.1, 0.5, 1.2)
	 */
	calculateElapsedPeriods(
		lastUpdateTime: number,
		currentTime: number = Date.now()
	): number {
		const elapsedMs = currentTime - lastUpdateTime
		return Math.max(0, elapsedMs / this.ratingPeriodMs)
	}

	/**
	 * Calculates new Rating Deviation based on elapsed time
	 * Implements: newRD = sqrt(oldRD² + elapsedPeriods × volatility²)
	 * @param currentRd Current rating deviation
	 * @param volatility Player's volatility
	 * @param elapsedPeriods Fractional rating periods elapsed
	 * @returns New rating deviation
	 */
	calculateNewRd(
		currentRd: number,
		volatility: number,
		elapsedPeriods: number
	): number {
		return Math.sqrt(
			Math.pow(currentRd, 2) + elapsedPeriods * Math.pow(volatility, 2)
		)
	}

	/**
	 * Gets the rating period duration in milliseconds
	 */
	getRatingPeriodMs(): number {
		return this.ratingPeriodMs
	}

	/**
	 * Gets the rating period duration in days
	 */
	getRatingPeriodDays(): number {
		return this.ratingPeriodMs / (24 * 60 * 60 * 1000)
	}
}
