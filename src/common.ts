import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts"
import { BIGINT_ONE, BIGINT_ZERO, EIGENPIE_POINT_PER_SEC, EIGEN_LAYER_POINT_PER_SEC, EIGEN_LAYER_LAUNCH_TIME, ETHER_ONE } from "./constants";
import { GroupMlrtPoolStatus, GroupPartnerLpStatus, ReferralGroup, UserData, UserPartnerLpDepositData, UserPoolDepositData } from "../generated/schema";
import { calEigenpiePointGroupBoost, globalBoost } from "./boost-module";
import { MLRT } from "../generated/templates/MLRT/MLRT"
import { loadOrCreateGroupMlrtPoolStatus, loadOrCreateGroupPartnerLpStatus, loadOrCreateUserDepositData, loadOrCreateUserPartnerLpDepositData } from "./entity-operations";

// Utility Functions

function getEffectiveLastUpdateTimestamp(lastUpdateTimestamp: BigInt): BigInt {
    return lastUpdateTimestamp.le(EIGEN_LAYER_LAUNCH_TIME) ? EIGEN_LAYER_LAUNCH_TIME : lastUpdateTimestamp;
}

function calculatePointsPerShare(accumulatedPoints: BigInt, totalAmount: BigInt): BigInt {
    if (totalAmount.equals(BIGINT_ZERO)) {
        return BIGINT_ZERO;
    }
    return accumulatedPoints.times(ETHER_ONE).div(totalAmount);
}

export function calculatePoolEarnedPoints(totalTvl: BigInt, timeDiff: BigInt, pointsPerSec: BigInt): BigInt {
    return totalTvl.times(timeDiff).times(pointsPerSec).div(ETHER_ONE);
}

function calculateEarnedEigenLayerPoints(lastUpdateTimestamp: BigInt, blockTimestamp: BigInt, totalAmount: BigInt, mlrtExchangeRateToETH: BigInt): BigInt {
    if (blockTimestamp.ge(EIGEN_LAYER_LAUNCH_TIME)) {
        const effectiveLastUpdateTimestamp = getEffectiveLastUpdateTimestamp(lastUpdateTimestamp);
        const timeDiff = blockTimestamp.minus(effectiveLastUpdateTimestamp);
        return calculatePoolEarnedPoints(totalAmount.times(mlrtExchangeRateToETH).div(ETHER_ONE), timeDiff, EIGEN_LAYER_POINT_PER_SEC);
    }
    return BIGINT_ZERO;
}

function calculateEarnedEigenpiePoints(lastUpdateTimestamp: BigInt, blockTimestamp: BigInt, totalAmount: BigInt, boostMultiplier: BigInt): BigInt {
    const timeDiff = blockTimestamp.minus(lastUpdateTimestamp);
    return calculatePoolEarnedPoints(totalAmount, timeDiff, boostMultiplier);
}

// Main Logic

export function harvestPointsForGroupMlrtPool(pool: GroupMlrtPoolStatus, group: ReferralGroup, blockTimestamp: BigInt, mlrtExchangeRateToETH: BigInt): void {
    harvestEigenLayerPointsForGroupMlrtPoolIfNeeded(pool, blockTimestamp, mlrtExchangeRateToETH);
    harvesetEigenpiePointsForGroupMlrtPool(pool, group, blockTimestamp, mlrtExchangeRateToETH);
    pool.lastUpdateTimestamp = blockTimestamp;
    pool.save();
}

function harvestEigenLayerPointsForGroupMlrtPoolIfNeeded(pool: GroupMlrtPoolStatus, blockTimestamp: BigInt, mlrtExchangeRateToETH: BigInt): void {
    const earnedPoints = calculateEarnedEigenLayerPoints(pool.lastUpdateTimestamp, blockTimestamp, pool.totalAmount, mlrtExchangeRateToETH);
    pool.accumulateEigenLayerPoints = pool.accumulateEigenLayerPoints.plus(earnedPoints);
    pool.accEigenLayerPointPerShare = calculatePointsPerShare(pool.accumulateEigenLayerPoints, pool.totalAmount);
}

function harvesetEigenpiePointsForGroupMlrtPool(pool: GroupMlrtPoolStatus, group: ReferralGroup, blockTimestamp: BigInt, mlrtExchangeRateToETH: BigInt): void {
    const boostMultiplier = EIGENPIE_POINT_PER_SEC.times(group.groupBoost).times(globalBoost(blockTimestamp));
    const totalAmount = (pool.totalAmount.plus(pool.totalUnmintedMlrt)).times(mlrtExchangeRateToETH).div(ETHER_ONE);
    const earnedPoints = calculateEarnedEigenpiePoints(pool.lastUpdateTimestamp, blockTimestamp, totalAmount, boostMultiplier);

    pool.accumulateEigenpiePoints = pool.accumulateEigenpiePoints.plus(earnedPoints);
    pool.accEigenpiePointPerShare = calculatePointsPerShare(pool.accumulateEigenpiePoints, pool.totalAmount.plus(pool.totalUnmintedMlrt));
}

export function harvestPointsForGroupPartnerLpPool(LpTvlEth: BigInt, mlrtBalanceForPool: BigInt, pool: GroupPartnerLpStatus, group: ReferralGroup, blockTimestamp: BigInt): void {
    harvestEigenLayerPointsForGroupPartnerLpPoolIfNeeded(mlrtBalanceForPool, pool, blockTimestamp);
    harvesetEigenpiePointsForGroupPartnerLpPool(LpTvlEth, pool, group, blockTimestamp);
    pool.lastUpdateTimestamp = blockTimestamp;
    pool.save();
}

function harvestEigenLayerPointsForGroupPartnerLpPoolIfNeeded(mlrtTvlEth: BigInt, pool: GroupPartnerLpStatus, blockTimestamp: BigInt): void {
    const earnedPoints = calculateEarnedEigenLayerPoints(pool.lastUpdateTimestamp, blockTimestamp, mlrtTvlEth, BIGINT_ONE);
    pool.accumulateEigenLayerPoints = pool.accumulateEigenLayerPoints.plus(earnedPoints);
    pool.accEigenLayerPointPerShare = calculatePointsPerShare(pool.accumulateEigenLayerPoints, pool.totalAmount);
}

function harvesetEigenpiePointsForGroupPartnerLpPool(LpTvlEth: BigInt, pool: GroupPartnerLpStatus, group: ReferralGroup, blockTimestamp: BigInt): void {
    const boostMultiplier = EIGENPIE_POINT_PER_SEC.times(group.groupBoost).times(globalBoost(blockTimestamp));
    const earnedPoints = calculateEarnedEigenpiePoints(pool.lastUpdateTimestamp, blockTimestamp, LpTvlEth, boostMultiplier);

    pool.accumulateEigenpiePoints = pool.accumulateEigenpiePoints.plus(earnedPoints);
    pool.accEigenpiePointPerShare = calculatePointsPerShare(pool.accumulateEigenpiePoints, pool.totalAmount);
}

// User-Related Business Logic

export function harvestPointsForUserFromMlrtPool(userGroupMlrtPoolrtPool: UserPoolDepositData, user: UserData, group: ReferralGroup): void {
    const mlrt = MLRT.bind(Address.fromBytes(userGroupMlrtPoolrtPool.mlrt));
    const mlrtPoolStatus = loadOrCreateGroupMlrtPoolStatus(group.id, userGroupMlrtPoolrtPool.mlrt);
    const userPoolDepositData = loadOrCreateUserDepositData(user.id, mlrt.underlyingAsset() as Bytes, userGroupMlrtPoolrtPool.mlrt);

    harvestEigenLayerPointsForUserFromMlrtPool(userPoolDepositData, mlrtPoolStatus);
    harvestEigenpiePointsForUserFromMlrtPool(userPoolDepositData, mlrtPoolStatus);

    userPoolDepositData.save();
}

function harvestEigenLayerPointsForUserFromMlrtPool(depositData: UserPoolDepositData, poolStatus: GroupMlrtPoolStatus): void {
    const accPointsEarned = depositData.mlrtAmount.times(poolStatus.accEigenLayerPointPerShare).div(ETHER_ONE);
    depositData.eigenLayerPoints = depositData.eigenLayerPoints.plus(accPointsEarned.minus(depositData.eigenLayerPointsDebt));
    depositData.eigenLayerPointsDebt = accPointsEarned;
}

function harvestEigenpiePointsForUserFromMlrtPool(depositData: UserPoolDepositData, poolStatus: GroupMlrtPoolStatus): void {
    const totalMlrt = depositData.mlrtAmount.plus(depositData.unmintedMlrt);
    const accPointsEarned = totalMlrt.times(poolStatus.accEigenpiePointPerShare).div(ETHER_ONE);
    depositData.eigenpiePoints = depositData.eigenpiePoints.plus(accPointsEarned.minus(depositData.eigenpiePointsDebt));
    depositData.eigenpiePointsDebt = accPointsEarned;
}

export function harvestPointsForUserFromPartnerLpPool(lpAddress: Address, prtotcol: string, user: UserData, group: ReferralGroup): void {
    const mlrtPoolStatus = loadOrCreateGroupPartnerLpStatus(group.id, lpAddress, prtotcol);
    const userPoolDepositData = loadOrCreateUserPartnerLpDepositData(user.id, lpAddress, prtotcol);

    harvestEigenLayerPointsForUserFromPartnerLpPool(userPoolDepositData, mlrtPoolStatus);
    harvestEigenpiePointsForUserFromPartnerLpPool(userPoolDepositData, mlrtPoolStatus);

    userPoolDepositData.save();
}

function harvestEigenLayerPointsForUserFromPartnerLpPool(depositData: UserPartnerLpDepositData, poolStatus: GroupPartnerLpStatus): void {
    const accPointsEarned = depositData.lpAmount.times(poolStatus.accEigenLayerPointPerShare).div(ETHER_ONE);
    depositData.eigenLayerPoints = depositData.eigenLayerPoints.plus(accPointsEarned.minus(depositData.eigenLayerPointsDebt));
    depositData.eigenLayerPointsDebt = accPointsEarned;
}

function harvestEigenpiePointsForUserFromPartnerLpPool(depositData: UserPartnerLpDepositData, poolStatus: GroupPartnerLpStatus): void {
    const accPointsEarned = depositData.lpAmount.times(poolStatus.accEigenpiePointPerShare).div(ETHER_ONE);
    depositData.eigenpiePoints = depositData.eigenpiePoints.plus(accPointsEarned.minus(depositData.eigenpiePointsDebt));
    depositData.eigenpiePointsDebt = accPointsEarned;
}

// Auxiliary Functions

export function getExchangeRateToNative(mlrtAddress: Address): BigInt {
    const mlrtContract = MLRT.bind(mlrtAddress);
    const tryExchangeRateToNative = mlrtContract.try_exchangeRateToNative();
    return tryExchangeRateToNative.reverted ? ETHER_ONE : tryExchangeRateToNative.value;
}

export function updateGroupBoostAndTVL(groupData: ReferralGroup): void {
    const result = calEigenpiePointGroupBoost(groupData.mlrtPoolStatus.load());
    groupData.groupBoost = result[0];
    groupData.groupTVL = result[1];
    groupData.save();
}