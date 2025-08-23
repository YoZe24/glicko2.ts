import { newProcedure, volatilityArgs } from '../algorithms/volatility.ts'
import { FractionalPeriodCalculator } from '../algorithms/fractional-period-calculator.ts'

const scalingFactor = 173.7178

/**
 * Interface representing a player's current rating state with time information
 */
export interface PlayerRatingState {
	rating: number
	rd: number
	vol: number
	lastUpdateTime: number
}

/**
 * The class for a player object
 */
export class Player {
	/**
	 * Internal value for Tau
	 */
	private _tau: number
	/**
	 * Internal rating in the Glicko-2 scale
	 */
	private __rating: number
	/**
	 * Internal rating deviation
	 */
	private __rd: number
	/**
	 * Internal volatility
	 */
	private __vol: number
	/**
	 * An array of the ratings of the opponents faced
	 */
	public adv_ranks: number[] = []
	/**
	 * An array of the rating deviations of the opponents faced
	 */
	public adv_rds: number[] = []
	/**
	 * An array of the outcomes the player has been in
	 */
	public outcomes: number[] = []
	/**
	 * The default rating of the player
	 * Used in calculations between the Glicko scales
	 * @default 1500
	 */
	public defaultRating = 1500
	/**
	 * The id of the player
	 * @default 0
	 */
	public id = 0
	/**
	 * The volatility Algorithm for the player
	 * @default {@link newProcedure}
	 */
	public volatilityAlgorithm: (
		v: number,
		delta: number,
		{ vol, tau, rd, rating }: volatilityArgs
	) => number = newProcedure
	
	/**
	 * Timestamp of the last rating update (Unix milliseconds)
	 * @default Current time when player is created
	 */
	private lastUpdateTime: number = Date.now()
	
	/**
	 * Fractional period calculator instance (optional, set by Glicko2 when enabled)
	 */
	private fractionalCalculator?: FractionalPeriodCalculator

	constructor(rating: number, rd: number, vol: number, tau: number) {
		this._tau = tau
		this.__rating = (rating - this.defaultRating) / scalingFactor
		this.__rd = rd / scalingFactor
		this.__vol = vol
	}

	/**
	 * @returns The rating of the player in the Glicko format
	 */
	public getRating(): number {
		return this.__rating * scalingFactor + this.defaultRating
	}

	/**
	 * Sets the rating of the player
	 * @param rating The rating in Glicko format
	 */
	public setRating(rating: number): void {
		this.__rating = (rating - this.defaultRating) / scalingFactor
	}

	/**
	 * @returns The rating deviation of the player
	 */
	public getRd(): number {
		return this.__rd * scalingFactor
	}

	/**
	 * Sets the rating deviation of the player
	 */
	public setRd(rd: number): void {
		this.__rd = rd / scalingFactor
	}

	/**
	 * @returns The volatility value of the player
	 */
	public getVol(): number {
		return this.__vol
	}

	/**
	 * Sets the volatility value of the player
	 */
	public setVol(vol: number): void {
		this.__vol = vol
	}

	/**
	 * @returns An object of the players rating, rating deviation, volatility and the recent outcomes
	 */
	public getRatings(): {
		rating: number
		rd: number
		vol: number
		outcomes: number[]
	} {
		return {
			rating: this.getRating(),
			rd: this.getRd(),
			vol: this.__vol,
			outcomes: this.outcomes,
		}
	}

	/**
	 * Adds a result to the players object
	 * @param outcome The outcome: 0 = defeat, 1 = victory, 0.5 = draw
	 */
	public addResult(opponent: Player, outcome: number): void {
		this.adv_ranks.push(opponent.__rating)
		this.adv_rds.push(opponent.__rd)
		this.outcomes.push(outcome)
	}

	/**
	 * Calculates the new rating and rating deviation of the player.
	 * Follows the steps of the algorithm described at http://www.glicko.net/glicko/glicko2.pdf
	 */
	public update_rank(): void {
		if (!this.hasPlayed()) {
			// Applies only the Step 6 of the algorithm
			this._preRatingRD()
			return
		}

		//Step 1 : done by Player initialization
		//Step 2 : done by setRating and setRd

		//Step 3
		const v = this._letiance()

		//Step 4
		const delta = this._delta(v)

		//Step 5
		this.__vol = this.volatilityAlgorithm(v, delta, {
			vol: this.__vol,
			tau: this._tau,
			rd: this.__rd,
			rating: this.__rating,
		})

		//Step 6
		this._preRatingRD()

		//Step 7
		this.__rd = 1 / Math.sqrt(1 / Math.pow(this.__rd, 2) + 1 / v)

		let tempSum = 0
		for (let i = 0, len = this.adv_ranks.length; i < len; i++) {
			tempSum +=
				this._g(this.adv_rds[i]) *
				(this.outcomes[i] - this._E(this.adv_ranks[i], this.adv_rds[i]))
		}
		this.__rating += Math.pow(this.__rd, 2) * tempSum

		//Step 8 : done by getRating and getRd
	}

	/**
	 * @returns A boolean value of if the player has played a game
	 */
	public hasPlayed(): boolean {
		return this.outcomes.length > 0
	}

	/**
	 * Calculates and updates the player's rating deviation for the beginning of a rating period.
	 * preRatingRD() -> None
	 */
	private _preRatingRD() {
		this.__rd = Math.sqrt(Math.pow(this.__rd, 2) + Math.pow(this.__vol, 2))
	}

	/**
	 * Calculation of the estimated letiance of the player's rating based on game outcomes
	 */
	private _letiance() {
		let tempSum = 0
		for (let i = 0, len = this.adv_ranks.length; i < len; i++) {
			const tempE = this._E(this.adv_ranks[i], this.adv_rds[i])
			tempSum +=
				Math.pow(this._g(this.adv_rds[i]), 2) * tempE * (1 - tempE)
		}
		return 1 / tempSum
	}

	/**
	 * The Glicko E function.
	 */
	private _E(p2rating: number, p2RD: number) {
		return (
			1 / (1 + Math.exp(-1 * this._g(p2RD) * (this.__rating - p2rating)))
		)
	}

	/**
	 * The Glicko2 g(RD) function.
	 */
	private _g(RD: number) {
		return 1 / Math.sqrt(1 + (3 * Math.pow(RD, 2)) / Math.pow(Math.PI, 2))
	}

	/**
	 * The delta function of the Glicko2 system.
	 * Calculation of the estimated improvement in rating (step 4 of the algorithm)
	 */
	private _delta(v: number) {
		let tempSum = 0
		for (let i = 0, len = this.adv_ranks.length; i < len; i++) {
			tempSum +=
				this._g(this.adv_rds[i]) *
				(this.outcomes[i] - this._E(this.adv_ranks[i], this.adv_rds[i]))
		}
		return v * tempSum
	}

	/**
	 * Sets the fractional period calculator for time-based RD updates
	 * @param calculator The fractional period calculator instance
	 */
	public setFractionalCalculator(calculator: FractionalPeriodCalculator): void {
		this.fractionalCalculator = calculator
	}

	/**
	 * Gets the last update time
	 * @returns Unix timestamp in milliseconds
	 */
	public getLastUpdateTime(): number {
		return this.lastUpdateTime
	}

	/**
	 * Sets the last update time
	 * @param timestamp Unix timestamp in milliseconds
	 */
	public setLastUpdateTime(timestamp: number): void {
		this.lastUpdateTime = timestamp
	}

	/**
	 * Updates RD based on elapsed time since last update
	 * Implements: newRD = sqrt(oldRD² + elapsedPeriods × volatility²)
	 * @param currentTime Current time in Unix milliseconds (defaults to Date.now())
	 */
	public updateRdForTimeElapsed(currentTime: number = Date.now()): void {
		if (!this.fractionalCalculator) return

		const elapsedPeriods = this.fractionalCalculator.calculateElapsedPeriods(
			this.lastUpdateTime,
			currentTime
		)

		if (elapsedPeriods > 0) {
			const currentRd = this.getRd()
			const newRd = this.fractionalCalculator.calculateNewRd(
				currentRd,
				this.__vol,
				elapsedPeriods
			)
			this.setRd(newRd)
			this.lastUpdateTime = currentTime
		}
	}

	/**
	 * Gets current rating with time-based RD decay applied
	 * This method does not modify the original player state
	 * @param currentTime Current time in Unix milliseconds (defaults to Date.now())
	 * @returns Current rating state with time-adjusted RD
	 */
	public getCurrentRating(currentTime: number = Date.now()): PlayerRatingState {
		if (!this.fractionalCalculator) {
			return {
				rating: this.getRating(),
				rd: this.getRd(),
				vol: this.getVol(),
				lastUpdateTime: this.lastUpdateTime
			}
		}

		// Calculate time-adjusted RD without modifying the player
		const elapsedPeriods = this.fractionalCalculator.calculateElapsedPeriods(
			this.lastUpdateTime,
			currentTime
		)

		const currentRd = this.getRd()
		const timeAdjustedRd = elapsedPeriods > 0 
			? this.fractionalCalculator.calculateNewRd(currentRd, this.__vol, elapsedPeriods)
			: currentRd

		return {
			rating: this.getRating(),
			rd: timeAdjustedRd,
			vol: this.getVol(),
			lastUpdateTime: currentTime
		}
	}

	/**
	 * Creates a deep clone of this player
	 * @returns A new Player instance with identical values
	 */
	public clone(): Player {
		const clonedPlayer = new Player(
			this.getRating(),
			this.getRd(),
			this.getVol(),
			this._tau
		)
		
		// Copy all the properties
		clonedPlayer.defaultRating = this.defaultRating
		clonedPlayer.volatilityAlgorithm = this.volatilityAlgorithm
		clonedPlayer.id = this.id
		clonedPlayer.lastUpdateTime = this.lastUpdateTime
		clonedPlayer.adv_ranks = [...this.adv_ranks]
		clonedPlayer.adv_rds = [...this.adv_rds]
		clonedPlayer.outcomes = [...this.outcomes]
		
		if (this.fractionalCalculator) {
			clonedPlayer.setFractionalCalculator(this.fractionalCalculator)
		}
		
		return clonedPlayer
	}
}
