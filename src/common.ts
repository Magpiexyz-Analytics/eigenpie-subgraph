import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts"
import { BIGINT_ZERO, EIGENPIE_POINT_PER_SEC, EIGEN_LAYER_POINT_PER_SEC, EIGEN_POINT_LAUNCH_TIME, ETHER_ONE } from "./constants";
import { GroupMlrtPoolStatus, ReferralGroup, UserData, UserPoolDepositData } from "../generated/schema";
import { globalBoost } from "./boost-module";
import { MLRT } from "../generated/templates/MLRT/MLRT"
import { loadOrCreateGroupMlrtPoolStatus, loadOrCreateUserDepositData } from "./entity-operations";

export function harvestPointsForGroupMlrtPool(pool: GroupMlrtPoolStatus, group: ReferralGroup, blockTimestamp: BigInt, mlrtExchangeRateToETH: BigInt): void {
    harvestEigenLayerPointsForGroupMlrtPoolIfNeeded(pool, blockTimestamp, mlrtExchangeRateToETH);
    harvesetEigenpiePointsForGroupMlrtPool(pool, group, blockTimestamp, mlrtExchangeRateToETH);
    pool.lastUpdateTimestamp = blockTimestamp;
    pool.save();
}

function harvestEigenLayerPointsForGroupMlrtPoolIfNeeded(pool: GroupMlrtPoolStatus, blockTimestamp: BigInt, mlrtExchangeRateToETH: BigInt): void {
    if (blockTimestamp.ge(EIGEN_POINT_LAUNCH_TIME)) {
        const effectiveLastUpdateTimestamp = getEffectiveLastUpdateTimestamp(pool.lastUpdateTimestamp);
        const timeDiff = blockTimestamp.minus(effectiveLastUpdateTimestamp);
        const earnedPoints = calculatePoolEarnedPoints(pool.totalAmount.times(mlrtExchangeRateToETH).div(ETHER_ONE), timeDiff, EIGEN_LAYER_POINT_PER_SEC);

        pool.accumulateEigenLayerPoints = pool.accumulateEigenLayerPoints.plus(earnedPoints);
        pool.accEigenLayerPointPerShare = calculatePointsPerShare(pool.accumulateEigenLayerPoints, pool.totalAmount);
    }
}

function getEffectiveLastUpdateTimestamp(lastUpdateTimestamp: BigInt): BigInt {
    return lastUpdateTimestamp.le(EIGEN_POINT_LAUNCH_TIME) ? EIGEN_POINT_LAUNCH_TIME : lastUpdateTimestamp;
}

function harvesetEigenpiePointsForGroupMlrtPool(pool: GroupMlrtPoolStatus, group: ReferralGroup, blockTimestamp: BigInt, mlrtExchangeRateToETH: BigInt): void {
    const timeDiff = blockTimestamp.minus(pool.lastUpdateTimestamp);
    const boostMultiplier = EIGENPIE_POINT_PER_SEC.times(group.groupBoost).times(globalBoost(blockTimestamp));
    const earnedPoints = calculatePoolEarnedPoints((pool.totalAmount.plus(pool.totalUnmintedMlrt)).times(mlrtExchangeRateToETH).div(ETHER_ONE), timeDiff, boostMultiplier);

    pool.accumulateEigenpiePoints = pool.accumulateEigenpiePoints.plus(earnedPoints);
    pool.accEigenpiePointPerShare = calculatePointsPerShare(pool.accumulateEigenpiePoints, pool.totalAmount.plus(pool.totalUnmintedMlrt));
}

export function calculatePoolEarnedPoints(totalTvl: BigInt, timeDiff: BigInt, pointsPerSec: BigInt): BigInt {
    return totalTvl.times(timeDiff).times(pointsPerSec).div(ETHER_ONE);
}

function calculatePointsPerShare(accumulatedPoints: BigInt, totalAmount: BigInt): BigInt {
    if (totalAmount.equals(BIGINT_ZERO)) {
        return BIGINT_ZERO;
    }
    return accumulatedPoints.times(ETHER_ONE).div(totalAmount);
}

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