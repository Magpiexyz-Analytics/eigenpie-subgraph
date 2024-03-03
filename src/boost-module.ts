import { BigInt } from "@graphprotocol/graph-ts"
import { GroupMlrtPoolStatus } from "../generated/schema"
import { BIGINT_ZERO, DENOMINATOR, ETHER_ONE } from "./constants"

export function calEigenpiePointGroupBoost(mlrtPoolStatuses: GroupMlrtPoolStatus[]): BigInt[] {
    let boostMultiplier = DENOMINATOR
    let totalTvl = BIGINT_ZERO

    // Sum total TVL across all mlrtPoolStatuses
    for (let i = 0; i < mlrtPoolStatuses.length; i++) {
        totalTvl = totalTvl.plus(mlrtPoolStatuses[i].totalTvl)
    }

    // Define TVL thresholds and their corresponding boost values
    const tvlThresholds: BigInt[] = [
        BigInt.fromI32(100).times(ETHER_ONE),
        BigInt.fromI32(500).times(ETHER_ONE),
        BigInt.fromI32(1000).times(ETHER_ONE),
        BigInt.fromI32(2000).times(ETHER_ONE),
        BigInt.fromI32(5000).times(ETHER_ONE)
    ]

    const boostValues = [12000, 14000, 16000, 18000, 20000]

    // Determine the boost multiplier based on the total TVL
    for (let i = tvlThresholds.length - 1; i >= 0; i--) {
        if (totalTvl.ge(tvlThresholds[i])) {
            boostMultiplier = BigInt.fromI32(boostValues[i])
            break
        }
    }

    return [boostMultiplier, totalTvl]
}

export function extraBoost(timestamp: BigInt): BigInt {
    let boost = DENOMINATOR

    // Launch boost event
    // Duration: from Eigenpie launche time to 2024/2/13 0:00 UTC (14 days)
    if (timestamp.le(BigInt.fromI32(1707782400)))
        boost = DENOMINATOR.times(BigInt.fromI32(2))

    // Pre-deposit boost event 
    // Duration: from 2024/2/24 9:00 - 2024/3/5 9:00 UTC (10 days)
    if (timestamp.gt(BigInt.fromI32(1708765200)) && timestamp.le(BigInt.fromI32(1709629200)))
        boost = DENOMINATOR.times(BigInt.fromI32(2))

    return boost
}