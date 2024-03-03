import { Address, BigInt, Bytes, store } from "@graphprotocol/graph-ts"
import { AssetDeposit as AssetDepositEventV1, EigenpieStaking, AssetDeposit1 } from "../generated/EigenpieStaking/EigenpieStaking"
import { UserData, ReferralGroup, UserPoolDepositData, GroupMlrtPoolStatus } from "../generated/schema"
import { MLRT } from "../generated/templates/MLRT/MLRT"
import { ADDRESS_ZERO, BIGINT_ZERO, EIGENPIE_POINT_PER_SEC, EIGEN_LAYER_POINT_PER_SEC, ETHER_ONE } from "./constants"
import { loadOrCreateGroupMlrtPoolStatus, loadOrCreateReferralGroup, loadOrCreateUserData, loadOrCreateUserDepositData, loadReferralStatus } from "./entity-operations"
import { calEigenpiePointGroupBoost } from "./boost-module"
import { log } from '@graphprotocol/graph-ts'

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
        harvestPoints(member, userGroup);
        member.referralGroup = referrerGroup.id;
        member.save();
    }

    // Harvest points for referrerGroupMembers
    for (let i = 0; i < referrerGroupMembers.length; i++) {
        let member = referrerGroupMembers[i];
        harvestPoints(member, referrerGroup);
    }
}

function harvestPoints(member: UserData, group: ReferralGroup): void {
    const mLrtPools = member.mLrtPools.load();
    for (let i = 0; i < mLrtPools.length; i++) {
        harvestPointsForPool(mLrtPools[i], member, group);
    }
}

function harvestPointsForPool(mLrtPool: UserPoolDepositData, member: UserData, group: ReferralGroup): void {
    const mlrt = MLRT.bind(Address.fromBytes(mLrtPool.mlrt));
    const mlrtPoolStatus = loadOrCreateGroupMlrtPoolStatus(group.id, mLrtPool.mlrt);
    const userPoolDepositData = loadOrCreateUserDepositData(member.id, mlrt.underlyingAsset() as Bytes, mLrtPool.mlrt);

    updateEigenLayerPoints(userPoolDepositData, mlrtPoolStatus);
    updateEigenpiePoints(userPoolDepositData, mlrtPoolStatus);

    userPoolDepositData.save();
}

function updateEigenLayerPoints(depositData: UserPoolDepositData, poolStatus: GroupMlrtPoolStatus): void {
    const accPointsEarned = depositData.mlrtAmount.times(poolStatus.accEigenLayerPointPerShare).div(ETHER_ONE);
    depositData.eigenLayerPoints = depositData.eigenLayerPoints.plus(accPointsEarned.minus(depositData.eigenLayerPointsDebt));
    depositData.eigenLayerPointsDebt = accPointsEarned;
}

function updateEigenpiePoints(depositData: UserPoolDepositData, poolStatus: GroupMlrtPoolStatus): void {
    const totalMlrt = depositData.mlrtAmount.plus(depositData.unmintedMlrt);
    const accPointsEarned = totalMlrt.times(poolStatus.accEigenpiePointPerShare).div(ETHER_ONE);
    depositData.eigenpiePoints = depositData.eigenpiePoints.plus(accPointsEarned.minus(depositData.eigenpiePointsDebt));
    depositData.eigenpiePointsDebt = accPointsEarned;
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

    // Update referrer group's mLrt pool with user group's mLrt pool data
    referrerGroupMlrtPool.totalTvl = referrerGroupMlrtPool.totalTvl.plus(userGroupMlrtPool.totalTvl);
    referrerGroupMlrtPool.totalAmount = referrerGroupMlrtPool.totalAmount.plus(userGroupMlrtPool.totalAmount);
    referrerGroupMlrtPool.totalUnmintedMlrt = referrerGroupMlrtPool.totalUnmintedMlrt.plus(userGroupMlrtPool.totalUnmintedMlrt);

    updateReferrerGroupMlrtPoolPoints(referrerGroupMlrtPool, blockTimestamp);

    referrerGroupMlrtPool.save();
    // Remove the merged user group's mLrt pool status
    store.remove("GroupMlrtPoolStatus", userGroupMlrtPool.id.toHexString());
}

function updateReferrerGroupMlrtPoolPoints(pool: GroupMlrtPoolStatus, blockTimestamp: BigInt): void {
    const timeDiff = blockTimestamp.minus(pool.lastUpdateTimestamp);

    const earnedEigenLayerPoints = calculateEarnedPoints(pool.totalTvl, timeDiff, EIGEN_LAYER_POINT_PER_SEC);
    pool.accumulateEigenLayerPoints = pool.accumulateEigenLayerPoints.plus(earnedEigenLayerPoints);
    pool.accEigenLayerPointPerShare = calculatePointsPerShare(pool.accumulateEigenLayerPoints, pool.totalAmount);

    const earnedEigenpiePoints = calculateEarnedPoints(pool.totalTvl, timeDiff, EIGENPIE_POINT_PER_SEC);
    pool.accumulateEigenpiePoints = pool.accumulateEigenpiePoints.plus(earnedEigenpiePoints);
    pool.accEigenpiePointPerShare = calculatePointsPerShare(pool.accumulateEigenpiePoints, pool.totalAmount.plus(pool.totalUnmintedMlrt));
    pool.lastUpdateTimestamp = blockTimestamp;
}

function calculateEarnedPoints(totalTvl: BigInt, timeDiff: BigInt, pointsPerSec: BigInt): BigInt {
    return totalTvl.times(timeDiff).times(pointsPerSec).div(ETHER_ONE);
}

function calculatePointsPerShare(accumulatedPoints: BigInt, totalAmount: BigInt): BigInt {
    if (totalAmount.equals(BIGINT_ZERO)) {
        return BIGINT_ZERO;
    }
    return accumulatedPoints.times(ETHER_ONE).div(totalAmount);
}

function finalizeGroupMergeAndCleanup(userGroup: ReferralGroup, referrerGroup: ReferralGroup): void {
    // Assuming calEigenpiePointGroupBoost returns an array with the new boost and TVL
    let res = calEigenpiePointGroupBoost(referrerGroup.mlrtPoolStatus.load());
    referrerGroup.groupBoost = res[0];
    referrerGroup.groupTVL = res[1];
    referrerGroup.save();

    // Cleanup the user group
    store.remove("ReferralGroup", userGroup.id.toHexString());

    // Update the referral status to reflect the reduced total number of groups
    let referralStatus = loadReferralStatus();
    referralStatus.totalGroups--;
    referralStatus.save();
}