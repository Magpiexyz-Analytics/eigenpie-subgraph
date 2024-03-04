import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts"
import { Transfer as TransferEvent, MLRT } from "../generated/templates/MLRT/MLRT"
import { ADDRESS_ZERO, BIGINT_ZERO, DENOMINATOR, EIGEN_POINT_LAUNCH_TIME, ETHER_ONE, EIGEN_LAYER_POINT_PER_SEC, EIGENPIE_PREDEPLOST_HELPER, EIGENPIE_POINT_PER_SEC } from "./constants"
import { ReferralGroup } from "../generated/schema"
import { loadOrCreateGroupMlrtPoolStatus, loadOrCreateReferralGroup, loadOrCreateUserData, loadOrCreateUserDepositData } from "./entity-operations"
import { calEigenpiePointGroupBoost, globalBoost } from "./boost-module"
import { calculatePoolEarnedPoints, getExchangeRateToNative, harvestPointsForGroupMlrtPool, harvestPointsForUserFromMlrtPool, updateGroupBoostAndTVL } from "./common"

const MST_WST_ETH_LP = Address.fromHexString("0xC040041088B008EAC1bf5FB886eAc8c1e244B60F")
const MSW_SW_ETH_LP = Address.fromHexString("0x2022d9AF896eCF0F1f5B48cdDaB9e74b5aAbCf00")

/** Event Handlers */

export function handleTransfer(event: TransferEvent): void {
    // handle depopsit (not pre-deposit)
    if (event.params.from.equals(ADDRESS_ZERO) && event.params.to.notEqual(EIGENPIE_PREDEPLOST_HELPER)) {
        depositHandler(event, false)
    }
    // handle pre-depopsit
    else if (event.params.from.equals(ADDRESS_ZERO) &&event.params.to.equals(EIGENPIE_PREDEPLOST_HELPER)) {
        depositHandler(event, true)
    }
    // redeem

    // handle exchange

    else if (
        event.params.from.equals(MST_WST_ETH_LP) // buy mlrt from Curve mst-wstETH pool
    ) {
        exchangeHandler(event, true)
    }
    else if (
        event.params.to.equals(MST_WST_ETH_LP) // sell mlrt from Curve mst-wstETH pool
    ) {
        exchangeHandler(event, false)
    }
    else if (
        event.params.from.equals(MSW_SW_ETH_LP) // buy mlrt from Curve msw-swETH pool
    ) {
        exchangeHandler(event, true)
    }
    else if (
        event.params.to.equals(MSW_SW_ETH_LP) // sell mlrt from Curve msw-swETH pool
    ) {
        exchangeHandler(event, false)
    }

    // handle transfer
}

/** Internal Functions for transactions */

function depositHandler(event: TransferEvent, isPreDeposit: boolean): void {
    const userData = loadOrCreateUserData(event.params.to);
    const groupData = loadOrCreateReferralGroup(userData.referralGroup);

    // Harvest group mLRT pool points variables to be up-to-date
    let groupMlrtPool = loadOrCreateGroupMlrtPoolStatus(groupData!.id, event.address)
    harvestPointsForGroupMlrtPool(groupMlrtPool, groupData, event.block.timestamp, getExchangeRateToNative(event.address));

    // Update group mLrt pool totalAmount, totalUnmintedMlrt, totalTvl
    if (isPreDeposit) {
        groupMlrtPool.totalUnmintedMlrt = groupMlrtPool.totalUnmintedMlrt.plus(event.params.value)
    } else {
        groupMlrtPool.totalAmount = groupMlrtPool.totalAmount.plus(event.params.value)
    }
    groupMlrtPool.save()

    // Harvest points for user from the mLRT pool
    let userMlrtPoolDepositData = loadOrCreateUserDepositData(userData.id, MLRT.bind(event.address).underlyingAsset() as Bytes, groupMlrtPool.mlrt);
    harvestPointsForUserFromMlrtPool(userMlrtPoolDepositData, userData, groupData);

    // update group boost and tvl
    updateGroupBoostAndTVL(groupData);
}


function exchangeHandler(event: TransferEvent, isBuy: boolean): void {
    let userData = loadOrCreateUserData(event.params.to)
    let groupData = ReferralGroup.load(userData.referralGroup)
    let mlrt = MLRT.bind(event.address)
    let try_exchangeRateToNative = mlrt.try_exchangeRateToNative()
    let exchangeRateToNative = (try_exchangeRateToNative.reverted) ? ETHER_ONE : try_exchangeRateToNative.value

    // update eigenlayer points for the pool
    let mlrtPoolStatus = loadOrCreateGroupMlrtPoolStatus(groupData!.id, event.address)
    let timeDiff = mlrtPoolStatus.lastUpdateTimestamp.minus(event.block.timestamp)
    let previousTotalTvl = mlrtPoolStatus.totalAmount.times(exchangeRateToNative).div(ETHER_ONE)
    let earnedEigenLayerPoint = previousTotalTvl.times(timeDiff).times(EIGEN_LAYER_POINT_PER_SEC).div(ETHER_ONE)
    if (isBuy)
        mlrtPoolStatus.totalAmount = mlrtPoolStatus.totalAmount.plus(event.params.value)
    else
        mlrtPoolStatus.totalAmount = mlrtPoolStatus.totalAmount.minus(event.params.value)
    mlrtPoolStatus.totalTvl = mlrtPoolStatus.totalAmount.times(exchangeRateToNative).div(ETHER_ONE)
    mlrtPoolStatus.accumulateEigenLayerPoints = mlrtPoolStatus.accumulateEigenLayerPoints.plus(earnedEigenLayerPoint)
    mlrtPoolStatus.accEigenLayerPointPerShare = (mlrtPoolStatus.totalAmount.gt(BIGINT_ZERO)) ? mlrtPoolStatus.accumulateEigenLayerPoints.times(ETHER_ONE).div(mlrtPoolStatus.totalAmount) : BIGINT_ZERO
    mlrtPoolStatus.save()

    // update eigenpie points for the pool
    let unmintedMlrtTvl = mlrtPoolStatus.totalUnmintedMlrt.times(exchangeRateToNative).div(ETHER_ONE)
    let totalTvlForEigenpie = previousTotalTvl.plus(unmintedMlrtTvl)
    // Todo: if boost during the time diff
    let earnedEigenpiePoint = totalTvlForEigenpie.times(timeDiff).times(EIGENPIE_POINT_PER_SEC).div(ETHER_ONE)
    let boostedEigenpiePoint = earnedEigenpiePoint.times(groupData!.groupBoost).times(globalBoost(event.block.timestamp)).div(DENOMINATOR.pow(2))
    mlrtPoolStatus.accumulateEigenpiePoints = mlrtPoolStatus.accumulateEigenpiePoints.plus(boostedEigenpiePoint)
    mlrtPoolStatus.accEigenpiePointPerShare = (mlrtPoolStatus.totalAmount.gt(BIGINT_ZERO)) ? mlrtPoolStatus.accumulateEigenpiePoints.times(ETHER_ONE).div(mlrtPoolStatus.totalAmount) : BIGINT_ZERO

    // update groupBoost
    let newGroupBoost = calEigenpiePointGroupBoost(groupData!.mlrtPoolStatus.load())
    groupData!.groupBoost = newGroupBoost[0]
    groupData!.groupTVL = newGroupBoost[1]

    // update eigenlayer points for the user
    let userPoolDepositData = loadOrCreateUserDepositData(event.params.to, mlrt.underlyingAsset(), event.address)
    if (isBuy)
        userPoolDepositData.mlrtAmount = userPoolDepositData.mlrtAmount.plus(event.params.value)
    else
        userPoolDepositData.mlrtAmount = userPoolDepositData.mlrtAmount.minus(event.params.value)
    let newDepositedTvl = event.params.value.times(exchangeRateToNative).div(ETHER_ONE)
    userPoolDepositData.eigenLayerPointsDebt = newDepositedTvl.times(mlrtPoolStatus.accEigenLayerPointPerShare).div(ETHER_ONE)
    userPoolDepositData.eigenLayerPoints = userPoolDepositData.mlrtAmount.times(mlrtPoolStatus.accEigenLayerPointPerShare).div(ETHER_ONE)
        .minus(userPoolDepositData.eigenLayerPointsDebt).plus(userPoolDepositData.eigenLayerPoints)

    // update eigenpie points for the user
    userPoolDepositData.eigenpiePointsDebt = newDepositedTvl.times(mlrtPoolStatus.accEigenpiePointPerShare).div(ETHER_ONE)
    userPoolDepositData.eigenpiePoints = userPoolDepositData.mlrtAmount.plus(userPoolDepositData.unmintedMlrt).times(mlrtPoolStatus.accEigenpiePointPerShare).div(ETHER_ONE)
        .minus(userPoolDepositData.eigenpiePointsDebt).plus(userPoolDepositData.eigenpiePoints)

    mlrtPoolStatus.lastUpdateTimestamp = event.block.timestamp
    mlrtPoolStatus.save()
    userPoolDepositData.save()
}