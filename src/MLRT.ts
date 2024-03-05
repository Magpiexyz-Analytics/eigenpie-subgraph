import { Address, Bytes } from "@graphprotocol/graph-ts"
import { Transfer as TransferEvent, MLRT } from "../generated/templates/MLRT/MLRT"
import { ADDRESS_ZERO, EIGENPIE_PREDEPLOST_HELPER } from "./constants"
import { loadOrCreateGroupMlrtPoolStatus, loadOrCreateReferralGroup, loadOrCreateUserData, loadOrCreateUserDepositData } from "./entity-operations"
import { getExchangeRateToNative, harvestPointsForGroupMlrtPool, harvestPointsForUserFromMlrtPool, updateGroupBoostAndTVL } from "./common"

const MST_WST_ETH_LP = Address.fromHexString("0xC040041088B008EAC1bf5FB886eAc8c1e244B60F")
const MSW_SW_ETH_LP = Address.fromHexString("0x2022d9AF896eCF0F1f5B48cdDaB9e74b5aAbCf00")

/** Event Handlers */

export function handleTransfer(event: TransferEvent): void {
    // Deposit handling (not pre-deposit)
    if (isDeposit(event)) {
        depositHandler(event);
        return; // Early return to prevent further checks once a match is found
    }

    // Placeholder for redeem handling
    // if (isRedeem(event)) {
    //     redeemHandler(event);
    //     return; // Early return after handling redeem
    // }

    // Placeholder for transfer handling
    // if (isTransfer(event)) {
    //     transferHandler(event);
    //     return; // Early return after handling transfer
    // }

    // Add more conditions here as needed
}

function isDeposit(event: TransferEvent): boolean {
    return event.params.from.equals(ADDRESS_ZERO);
}

function isPreDeposit(event: TransferEvent): boolean {
    return event.params.to.equals(EIGENPIE_PREDEPLOST_HELPER);
}

function isExchange(event: TransferEvent): boolean {
    return event.params.from.equals(MST_WST_ETH_LP) || 
           event.params.to.equals(MST_WST_ETH_LP) || 
           event.params.from.equals(MSW_SW_ETH_LP) || 
           event.params.to.equals(MSW_SW_ETH_LP);
}

/** Internal Functions for transactions */

function depositHandler(event: TransferEvent): void {
    const userData = loadOrCreateUserData(event.params.to);
    const groupData = loadOrCreateReferralGroup(userData.referralGroup);

    // Harvest group mLRT pool points variables to be up-to-date
    let groupMlrtPool = loadOrCreateGroupMlrtPoolStatus(groupData.id, event.address)
    harvestPointsForGroupMlrtPool(groupMlrtPool, groupData, event.block.timestamp, getExchangeRateToNative(event.address));

    // Update group mLrt pool totalAmount, totalUnmintedMlrt, totalTvl
    if (isPreDeposit(event)) {
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