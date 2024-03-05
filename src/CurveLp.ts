import { CurveLP, Transfer as TransferEvent, TokenExchange as TokenExchangeEvent } from "../generated/CurveLP-mst-wstETH/CurveLP"
import { CurveAsset } from "../generated/CurveLP-mst-wstETH/CurveAsset"
import { ADDRESS_ZERO, BIGINT_ONE, BIGINT_ZERO, ETHER_ONE } from "./constants"
import { loadOrCreateGroupPartnerLpStatus, loadOrCreateReferralGroup, loadOrCreateUserData, loadOrCreateUserPartnerLpDepositData } from "./entity-operations"
import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts"
import { PartnerLpStatus } from "../generated/schema"
import { getExchangeRateToNative, harvestPointsForGroupPartnerLpPool, harvestPointsForUserFromPartnerLpPool } from "./common"

/** Event Handlers */

export function handleTokenExchange(event: TokenExchangeEvent): void {
    let curveLpStatus = PartnerLpStatus.load(event.address)!
    let holdingGroups = curveLpStatus.holdingGroups

    let curveLpTvlEth = calculateLpTvlEth(event.address)

    for (let i = 0; i < holdingGroups.length; i++) {
        let groupData = loadOrCreateReferralGroup(holdingGroups[i])
        let groupCurveLpStatus = loadOrCreateGroupPartnerLpStatus(holdingGroups[i], event.address, "Curve")

        harvestPointsForGroupPartnerLpPool(curveLpTvlEth[0], curveLpTvlEth[1], groupCurveLpStatus, groupData, event.block.timestamp)
    }
}

export function handleTransfer(event: TransferEvent): void {
    if (
        event.params.sender.equals(ADDRESS_ZERO) // add liquidity
    ) {
        liquidityModifyHandler(event.params.receiver as Bytes, event.address as Bytes, event.params.value, event.block.timestamp, true)
    }
    else if (
        event.params.receiver.equals(ADDRESS_ZERO) // remove liquidity
    ) {
        liquidityModifyHandler(event.params.sender as Bytes, event.address as Bytes, event.params.value, event.block.timestamp, false)
    }
    else // lp transfer
    {
        liquidityTransferHandler(event)
    }
}

/** Internal Functions for transactions */

function liquidityModifyHandler(userAddress: Bytes, lpAddress: Bytes, amount: BigInt, timestamp: BigInt, isAddLiquidity: boolean): void {
    let curveLpStatus = PartnerLpStatus.load(lpAddress)
    if (!curveLpStatus) {
        curveLpStatus = new PartnerLpStatus(lpAddress)
        curveLpStatus.holdingGroups = []
    }

    let userData = loadOrCreateUserData(userAddress)
    let groupData = loadOrCreateReferralGroup(userData.referralGroup)
    let groupCurveLpStatus = loadOrCreateGroupPartnerLpStatus(userData.referralGroup, lpAddress, "Curve")
    let userCurveLpDepositData = loadOrCreateUserPartnerLpDepositData(userAddress, lpAddress, "Curve")
    if (isAddLiquidity) {
        groupCurveLpStatus.totalAmount = groupCurveLpStatus.totalAmount.plus(amount)
        userCurveLpDepositData.lpAmount = userCurveLpDepositData.lpAmount.plus(amount)
    } else {
        groupCurveLpStatus.totalAmount = groupCurveLpStatus.totalAmount.minus(amount)
        userCurveLpDepositData.lpAmount = userCurveLpDepositData.lpAmount.minus(amount)
    }
    userCurveLpDepositData.save()

    addNewHoldingGroupIfNeeded(userAddress, curveLpStatus)

    let curveLpTvlEth = calculateLpTvlEth(Address.fromBytes(lpAddress))

    harvestPointsForGroupPartnerLpPool(curveLpTvlEth[0], curveLpTvlEth[1], groupCurveLpStatus, groupData, timestamp)
    harvestPointsForUserFromPartnerLpPool(Address.fromBytes(lpAddress), "Curve", userData, groupData)
}

function addNewHoldingGroupIfNeeded(user: Bytes, curveLpStatus: PartnerLpStatus): void {
    let userData = loadOrCreateUserData(user)
    if (curveLpStatus.holdingGroups.indexOf(userData.referralGroup) === -1) {
        curveLpStatus.holdingGroups.push(userData.referralGroup)
    }

    curveLpStatus.save()
}

function liquidityTransferHandler(event: TransferEvent): void {
    let curveLpTvlEth = calculateLpTvlEth(event.address)

    let userDataFrom = loadOrCreateUserData(event.params.sender)
    let groupDataFrom = loadOrCreateReferralGroup(userDataFrom.referralGroup)
    let groupCurveLpStatusFrom = loadOrCreateGroupPartnerLpStatus(userDataFrom.referralGroup, event.address, "Curve")
    let userCurveLpDepositDataFrom = loadOrCreateUserPartnerLpDepositData(event.params.sender, event.address, "Curve")
    userCurveLpDepositDataFrom.lpAmount = userCurveLpDepositDataFrom.lpAmount.minus(event.params.value)
    harvestPointsForGroupPartnerLpPool(curveLpTvlEth[0], curveLpTvlEth[1], groupCurveLpStatusFrom, groupDataFrom, event.block.timestamp)
    harvestPointsForUserFromPartnerLpPool(event.address, "Curve", userDataFrom, groupDataFrom)

    let userDataTo = loadOrCreateUserData(event.params.receiver)
    let groupDataTo = loadOrCreateReferralGroup(userDataFrom.referralGroup)
    let groupCurveLpStatusTo = loadOrCreateGroupPartnerLpStatus(userDataTo.referralGroup, event.address, "Curve")
    let userCurveLpDepositDataTo = loadOrCreateUserPartnerLpDepositData(event.params.receiver, event.address, "Curve")
    userCurveLpDepositDataTo.lpAmount = userCurveLpDepositDataTo.lpAmount.plus(event.params.value)
    harvestPointsForGroupPartnerLpPool(curveLpTvlEth[0], curveLpTvlEth[1], groupCurveLpStatusTo, groupDataTo, event.block.timestamp)
    harvestPointsForUserFromPartnerLpPool(event.address, "Curve", userDataTo, groupDataTo)
}

function calculateLpTvlEth(lpAddress: Address): BigInt[] {
    let curveLp = CurveLP.bind(lpAddress)
    let token0AmountInPool = curveLp.balances(BIGINT_ZERO)
    let token1AmountInPool = curveLp.balances(BIGINT_ONE)

    let mlrtExchangeRateToNative = getExchangeRateToNative(curveLp.coins(BIGINT_ZERO))
    let token0AmountETH = token0AmountInPool.times(mlrtExchangeRateToNative).div(ETHER_ONE)

    let curveAsset = CurveAsset.bind(curveLp.coins(BIGINT_ONE))
    let lstExchangeRateToNative = getLstExchangeRateToNative(curveAsset)
    let token1AmountETH = token1AmountInPool.times(lstExchangeRateToNative).div(ETHER_ONE)

    return [token0AmountETH.plus(token1AmountETH), token0AmountETH, token1AmountETH]
}

function getLstExchangeRateToNative(curveAsset: CurveAsset): BigInt {
    if (curveAsset.symbol() == "wstETH") return curveAsset.tokensPerStEth()
    else return ETHER_ONE
}