import { Address, BigInt, Bytes, crypto } from "@graphprotocol/graph-ts"
import { Transfer as TransferEvent, MLRT } from "../generated/templates/MLRT/MLRT"
import { ADDRESS_ZERO, BIGINT_ZERO, DENOMINATOR, EIGEN_POINT_LAUNCH_TIME, ETHER_ONE, MLRT_POINT_PER_SEC, EIGEN_LAYER_POINT_PER_SEC } from "./constants"
import { GroupMlrtPoolStatus, ReferralGroup } from "../generated/schema"
import { loadOrCreateGroupMlrtPoolStatus, loadOrCreateUserData, loadOrCreateUserDepositData } from "./entity-operations"
import { calEigenpiePointGroupBoost } from "./boost-module"

/** Event Handlers */

export function handleTransfer(event: TransferEvent): void {
    // handle depopsit
    if (
        event.params.from.equals(ADDRESS_ZERO) &&
        event.params.to.notEqual(Address.fromHexString("0xcc5460cf8f81caa790b87910364e67ddb50e242b")) // not pre-deposit
    )
        depopsitHandler(event)

    // redeem

    // handle exchange

    // handle transfer
}

/** Internal Functions */

function depopsitHandler(event: TransferEvent): void {
    let userData = loadOrCreateUserData(event.params.to, ADDRESS_ZERO)
    let groupData = ReferralGroup.load(userData.referralGroup)
    let mlrt = MLRT.bind(event.address)
    let try_exchangeRateToNative = mlrt.try_exchangeRateToNative()
    let exchangeRateToNative = (try_exchangeRateToNative.reverted) ? ETHER_ONE : try_exchangeRateToNative.value
    let mlrtTotalSupply = mlrt.totalSupply() // need to check
    let currentTotalTvl = mlrtTotalSupply.times(exchangeRateToNative).div(ETHER_ONE)

    // update eigenlayer points for the pool
    let mlrtPoolStatus = loadOrCreateGroupMlrtPoolStatus(groupData!.id, event.address)
    let timeDiff = mlrtPoolStatus.lastUpdateTimestamp.minus(event.block.timestamp)
    let previousTotalTvl = mlrtPoolStatus.totalAmount.times(exchangeRateToNative).div(ETHER_ONE)
    let earnedEigenLayerPoint = previousTotalTvl.times(timeDiff).times(EIGEN_LAYER_POINT_PER_SEC).div(ETHER_ONE)
    mlrtPoolStatus.totalAmount = mlrtTotalSupply
    mlrtPoolStatus.accumulateEigenLayerPoints = mlrtPoolStatus.accumulateEigenLayerPoints.plus(earnedEigenLayerPoint)
    mlrtPoolStatus.accEigenLayerPointPerShare = mlrtPoolStatus.accumulateEigenLayerPoints.times(ETHER_ONE).div(currentTotalTvl)
    mlrtPoolStatus.totalTvl = currentTotalTvl
    mlrtPoolStatus.save()

    // update eigenpie points for the pool
    let unmintedMlrtTvl = mlrtPoolStatus.totalUnmintedMlrt.times(exchangeRateToNative).div(ETHER_ONE)
    let earnedEigenpiePoint = previousTotalTvl.plus(unmintedMlrtTvl).times(timeDiff).times(EIGEN_LAYER_POINT_PER_SEC).div(ETHER_ONE)
    let boostedEigenpiePoint = earnedEigenpiePoint.times(groupData!.groupBoost).div(DENOMINATOR)
    mlrtPoolStatus.accumulateEigenpiePoints = mlrtPoolStatus.accumulateEigenpiePoints.plus(boostedEigenpiePoint)
    mlrtPoolStatus.accEigenpiePointPerShare = mlrtPoolStatus.accumulateEigenpiePoints.times(ETHER_ONE).div(currentTotalTvl)

    // update groupBoost
    let newGroupBoost = calEigenpiePointGroupBoost(groupData!.mlrtPoolStatus.load())
    groupData!.groupBoost = newGroupBoost[0]
    groupData!.groupTVL = newGroupBoost[1]

    // update eigenlayer points for the user
    let userPoolDepositData = loadOrCreateUserDepositData(event.params.to, mlrt.underlyingAsset(), event.address)
    userPoolDepositData.amount = userPoolDepositData.amount.plus(event.params.value)
    let newDepositedTvl = event.params.value.times(exchangeRateToNative).div(ETHER_ONE)
    let currentTvl = userPoolDepositData.amount.minus(userPoolDepositData.unmintedMlrt).times(exchangeRateToNative).div(ETHER_ONE)
    userPoolDepositData.eigenLayerPointsDebt = newDepositedTvl.times(mlrtPoolStatus.accEigenLayerPointPerShare).div(ETHER_ONE)
    userPoolDepositData.eigenLayerPoints = currentTvl.times(mlrtPoolStatus.accEigenLayerPointPerShare).div(ETHER_ONE)
        .minus(userPoolDepositData.eigenLayerPointsDebt).plus(userPoolDepositData.eigenLayerPoints)

    mlrtPoolStatus.lastUpdateTimestamp = event.block.timestamp
    mlrtPoolStatus.save()
    userPoolDepositData.save()
}