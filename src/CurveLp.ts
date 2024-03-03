import { CurveLP, Transfer as TransferEvent, TokenExchange as TokenExchangeEvent } from "../generated/CurveLP-mst-wstETH/CurveLP"
import { CurveAsset } from "../generated/CurveLP-mst-wstETH/CurveAsset"
import { MLRT } from "../generated/templates/MLRT/MLRT"
import { ADDRESS_ZERO, BIGINT_ONE, BIGINT_ZERO, DENOMINATOR, EIGENPIE_POINT_PER_SEC, EIGEN_LAYER_POINT_PER_SEC, ETHER_ONE } from "./constants"
import { loadOrCreateGroupPartnerLpStatus, loadOrCreateReferralGroup, loadOrCreateUserData, loadOrCreateUserPartnerLpDepositData } from "./entity-operations"
import { BigInt } from "@graphprotocol/graph-ts"
import { PartnerLpStatus } from "../generated/schema"
import { calEigenpiePointGroupBoost, globalBoost } from "./boost-module"

/** Event Handlers */

export function handleTokenExchange(event: TokenExchangeEvent): void {
    let curveLp = CurveLP.bind(event.address)
    let token0AmountInPool = curveLp.balances(BIGINT_ZERO)
    let token1AmountInPool = curveLp.balances(BIGINT_ONE)

    let curveLpStatus = PartnerLpStatus.load(event.address)!
    let holdingGroups = curveLpStatus.holdingGroups

    for (let i = 0; i < holdingGroups.length; i++) {
        let groupData = loadOrCreateReferralGroup(holdingGroups[i])
        let groupCurveLpStatus = loadOrCreateGroupPartnerLpStatus(holdingGroups[i], event.address, "Curve")

        let mlrt = MLRT.bind(curveLp.coins(BIGINT_ZERO))
        let try_exchangeRateToNative = mlrt.try_exchangeRateToNative()
        let exchangeRateToNative = (try_exchangeRateToNative.reverted) ? ETHER_ONE : try_exchangeRateToNative.value
        let token0AmountETH = token0AmountInPool.times(exchangeRateToNative).div(ETHER_ONE)

        let curveAsset = CurveAsset.bind(curveLp.coins(BIGINT_ONE))
        let token1AmountETH = (curveAsset.symbol() == "wstETH") ? token1AmountInPool.times(curveAsset.tokensPerStEth()).div(ETHER_ONE) : token1AmountInPool

        // for eigenlayer points
        let timeDiff = groupCurveLpStatus.lastUpdateTimestamp.minus(event.block.timestamp)
        let earnedEigenLayerPoint = token0AmountETH.times(timeDiff).times(EIGEN_LAYER_POINT_PER_SEC).div(ETHER_ONE)
        groupCurveLpStatus.totalAmount = groupCurveLpStatus.totalAmount.plus(event.params.tokens_sold)
        groupCurveLpStatus.totalAmount = groupCurveLpStatus.totalAmount.minus(event.params.tokens_bought)
        groupCurveLpStatus.accumulateEigenLayerPoints = groupCurveLpStatus.accumulateEigenLayerPoints.plus(earnedEigenLayerPoint)
        groupCurveLpStatus.accEigenLayerPointPerShare = (groupCurveLpStatus.totalAmount.gt(BIGINT_ZERO)) ? groupCurveLpStatus.accumulateEigenLayerPoints.times(ETHER_ONE).div(groupCurveLpStatus.totalAmount) : BIGINT_ZERO

        // for eigenpie points
        let curveLpTvlEth = token0AmountETH.plus(token1AmountETH)
        let earnedEigenpiePoint = curveLpTvlEth.times(timeDiff).times(EIGENPIE_POINT_PER_SEC).div(ETHER_ONE)
        let boostedEigenpiePoint = earnedEigenpiePoint.times(groupData.groupBoost).times(globalBoost(event.block.timestamp)).div(DENOMINATOR.pow(2))
        groupCurveLpStatus.accumulateEigenpiePoints = groupCurveLpStatus.accumulateEigenpiePoints.plus(boostedEigenpiePoint)
        groupCurveLpStatus.accEigenpiePointPerShare = (groupCurveLpStatus.totalAmount.gt(BIGINT_ZERO)) ? groupCurveLpStatus.accumulateEigenpiePoints.times(ETHER_ONE).div(groupCurveLpStatus.totalAmount) : BIGINT_ZERO
        groupCurveLpStatus.save()

        let members = groupData.members.load()
        for (let j = 0; j < members.length; j++) {
            let holdingLps = members[i].curvePools.load()
            for (let k = 0; k < holdingLps.length; k++) {
                if (holdingLps[k].lpAddress.notEqual(event.address)) continue
                let userCurceLpDepositData = loadOrCreateUserPartnerLpDepositData(members[i].id, event.address, "Curve")
                userCurceLpDepositData.eigenLayerPoints = userCurceLpDepositData.lpAmount.times(groupCurveLpStatus.accEigenpiePointPerShare).div(ETHER_ONE)
                    .plus(userCurceLpDepositData.eigenLayerPoints)
                userCurceLpDepositData.eigenpiePoints = userCurceLpDepositData.lpAmount.times(groupCurveLpStatus.accEigenpiePointPerShare).div(ETHER_ONE)
                    .plus(userCurceLpDepositData.eigenpiePoints)
                userCurceLpDepositData.save()
            }
        }
    }
}

export function handleTransfer(event: TransferEvent): void {
    if (
        event.params.sender.equals(ADDRESS_ZERO) // add liquidity
    ) {
        updateLiquidityProvidersPoint(event)
    }
    else if (
        event.params.receiver.equals(ADDRESS_ZERO) // remove liquidity
    ) {
        updateLiquidityProvidersPoint(event)
    }
    else // lp transfer
    { }
}

/** Internal Functions for transactions */

function updateLiquidityProvidersPoint(event: TransferEvent): void {
    let curveLpStatus = PartnerLpStatus.load(event.address)
    if (!curveLpStatus) {
        curveLpStatus = new PartnerLpStatus(event.address)
        curveLpStatus.holdingGroups = []
    }

    let userData = loadOrCreateUserData(event.params.receiver)
    if (curveLpStatus.holdingGroups.indexOf(userData.referralGroup) === -1) {
        curveLpStatus.holdingGroups.push(userData.referralGroup)
    }

    
}