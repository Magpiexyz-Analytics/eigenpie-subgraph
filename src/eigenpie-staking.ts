import { Address, BigInt, Bytes, store } from "@graphprotocol/graph-ts"
import { AssetDeposit as AssetDepositEventV1, EigenpieStaking, AssetDeposit1 } from "../generated/EigenpieStaking/EigenpieStaking"
import { UserData, ReferralGroup, UserPoolDepositData, GroupMlrtPoolStatus } from "../generated/schema"
import { MLRT } from "../generated/templates/MLRT/MLRT"
import { ADDRESS_ZERO, BIGINT_ZERO, EIGENPIE_POINT_PER_SEC, EIGEN_LAYER_POINT_PER_SEC, ETHER_ONE } from "./constants"
import { loadOrCreateGroupMlrtPoolStatus, loadOrCreateReferralGroup, loadOrCreateUserData, loadOrCreateUserDepositData, loadReferralStatus } from "./entity-operations"
import { calEigenpiePointGroupBoost, globalBoost } from "./boost-module"
import { log } from '@graphprotocol/graph-ts'
import { calculatePoolEarnedPoints, getExchangeRateToNative, harvestPointsForGroupMlrtPool, harvestPointsForUserFromMlrtPool, updateGroupBoostAndTVL } from "./common"

export function handleAssetDepositV1(event: AssetDepositEventV1): void {
    assetDepositHandler(
        event.params.depositor,
        event.params.referral,
        event.block.timestamp
    )
}

export function handleAssetDeposit(event: AssetDeposit1): void {
    assetDepositHandler(
        event.params.depositor,
        event.params.referral,
        event.block.timestamp
    )
}

export function assetDepositHandler(depositor: Address, referral: Address, blockTimestamp: BigInt): void {
    let userData = loadOrCreateUserData(depositor, referral);
    if (isNewReferral(userData, referral)) {
        handleNewReferral(userData, referral, blockTimestamp);
    }
}

function isNewReferral(userData: UserData, referral: Address): boolean {
    return userData.referrer.equals(ADDRESS_ZERO) && referral.notEqual(ADDRESS_ZERO) && referral.notEqual(userData.id);
}

function handleNewReferral(userData: UserData, referral: Address, blockTimestamp: BigInt): void {
    let referrerData = loadOrCreateUserData(referral);
    incrementReferralCount(referrerData);
    assignReferrerToUser(userData, referral);

    if (areDifferentGroups(userData, referrerData)) {
        mergeUserAndReferrerGroups(userData, referrerData, blockTimestamp);
    }
}

function incrementReferralCount(referrerData: UserData): void {
    referrerData.referralCount++;
    referrerData.save();
}

function assignReferrerToUser(userData: UserData, referral: Address): void {
    userData.referrer = referral;
    userData.save();
}

function areDifferentGroups(userData: UserData, referrerData: UserData): boolean {
    return userData.referralGroup.notEqual(referrerData.referralGroup);
}

function mergeUserAndReferrerGroups(userData: UserData, referrerData: UserData, blockTimestamp: BigInt): void {
    let userGroup = loadOrCreateReferralGroup(userData.referralGroup);
    let referrerGroup = loadOrCreateReferralGroup(referrerData.referralGroup);

    harvestPointsForGroupMembers(userGroup, referrerGroup, blockTimestamp);
    mergeGroups(userGroup, referrerGroup, blockTimestamp);
}

function harvestPointsForGroupMembers(userGroup: ReferralGroup, referrerGroup: ReferralGroup, blockTimestamp: BigInt): void {
    let userGroupMembers = userGroup.members.load();
    let referrerGroupMembers = referrerGroup.members.load();

    // Harvest points for userGroupMembers and update their referralGroup
    for (let i = 0; i < userGroupMembers.length; i++) {
        let member = userGroupMembers[i];
        harvestPointsForUserForAllMlrtPools(member, userGroup);
        member.referralGroup = referrerGroup.id;
        member.save();
    }

    // Harvest points for referrerGroupMembers
    for (let i = 0; i < referrerGroupMembers.length; i++) {
        let member = referrerGroupMembers[i];
        harvestPointsForUserForAllMlrtPools(member, referrerGroup);
    }
}

function harvestPointsForUserForAllMlrtPools(member: UserData, group: ReferralGroup): void {
    const mLrtPools = member.mLrtPools.load();
    for (let i = 0; i < mLrtPools.length; i++) {
        harvestPointsForUserFromMlrtPool(mLrtPools[i], member, group);
    }
}

function mergeGroups(userGroup: ReferralGroup, referrerGroup: ReferralGroup, blockTimestamp: BigInt): void {
    mergeMlrtPoolsFromUserToReferrerGroup(userGroup, referrerGroup, blockTimestamp);
    finalizeGroupMergeAndCleanup(userGroup, referrerGroup);
}

function mergeMlrtPoolsFromUserToReferrerGroup(userGroup: ReferralGroup, referrerGroup: ReferralGroup, blockTimestamp: BigInt): void {
    let userGroupMlrtPools = userGroup.mlrtPoolStatus.load();

    for (let i = 0; i < userGroupMlrtPools.length; i++) {
        mergeSingleMlrtPool(userGroupMlrtPools[i], referrerGroup, blockTimestamp);
    }
}

function mergeSingleMlrtPool(userGroupMlrtPool: GroupMlrtPoolStatus, referrerGroup: ReferralGroup, blockTimestamp: BigInt): void {
    let referrerGroupMlrtPool = loadOrCreateGroupMlrtPoolStatus(referrerGroup.id, userGroupMlrtPool.mlrt);
    // Update referrer group mLRT pool points variables to be up-to-date
    harvestPointsForGroupMlrtPool(referrerGroupMlrtPool, referrerGroup, blockTimestamp, getExchangeRateToNative(userGroupMlrtPool.mlrt as Address));

    // Update referrer group's mLrt pool with user group's mLrt pool data
    referrerGroupMlrtPool.totalAmount = referrerGroupMlrtPool.totalAmount.plus(userGroupMlrtPool.totalAmount);
    referrerGroupMlrtPool.totalUnmintedMlrt = referrerGroupMlrtPool.totalUnmintedMlrt.plus(userGroupMlrtPool.totalUnmintedMlrt);
    referrerGroupMlrtPool.save();
    // Remove the merged user group's mLrt pool status
    store.remove("GroupMlrtPoolStatus", userGroupMlrtPool.id.toHexString());
}

function finalizeGroupMergeAndCleanup(userGroup: ReferralGroup, referrerGroup: ReferralGroup): void {
    // update group boost and tvl
    updateGroupBoostAndTVL(referrerGroup);

    // Cleanup the user group
    store.remove("ReferralGroup", userGroup.id.toHexString());

    // Update the referral status to reflect the reduced total number of groups
    let referralStatus = loadReferralStatus();
    referralStatus.totalGroups--;
    referralStatus.save();
}