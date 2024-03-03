import { Address, BigInt, Bytes, store } from "@graphprotocol/graph-ts"
import { AssetDeposit as AssetDepositEventV1, EigenpieStaking, AssetDeposit1 } from "../generated/EigenpieStaking/EigenpieStaking"
import { UserData } from "../generated/schema"
import { MLRT } from "../generated/templates/MLRT/MLRT"
import { ADDRESS_ZERO, ADDRESS_ZERO_BYTES, BIGINT_ZERO, EIGEN_LAYER_POINT_PER_SEC, ETHER_ONE } from "./constants"
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

export function assetDepositHandler(
    depositor: Address,
    referral: Address,
    blockTimestamp: BigInt
): void {
    let userData = loadOrCreateUserData(depositor, referral)
    // update the referral info if user's referrer was updated
    if (userData.referrer.equals(ADDRESS_ZERO) && referral.notEqual(ADDRESS_ZERO) && referral.notEqual(userData.id)) {
        // try to update the referrer
        let referrerData = loadOrCreateUserData(referral)
        referrerData.referralCount++
        referrerData.save()
        userData.referrer = referral
        userData.save()

        if (userData.referralGroup.notEqual(referrerData.referralGroup)) {
            // if the user and the referrer are not in the same group, merge them
            let userGroup = loadOrCreateReferralGroup(userData.referralGroup)
            let referrerGroup = loadOrCreateReferralGroup(referrerData.referralGroup)

            let userGroupMlrtPools = userGroup.mlrtPoolStatus.load()
            let referrerGroupMlrtPools = referrerGroup.mlrtPoolStatus.load()
            for (let i = 0; i < userGroupMlrtPools.length; i++) {
                let mlrtAddress = userGroupMlrtPools[i].mlrt
                let mlrt = MLRT.bind(Address.fromBytes(mlrtAddress))
                let try_exchangeRateToNative = mlrt.try_exchangeRateToNative()
                let exchangeRateToNative = (try_exchangeRateToNative.reverted) ? ETHER_ONE : try_exchangeRateToNative.value

                userGroupMlrtPools[i].totalTvl = userGroupMlrtPools[i].totalAmount.times(exchangeRateToNative).div(ETHER_ONE)
                let timeDiff = userGroupMlrtPools[i].lastUpdateTimestamp.minus(blockTimestamp)
                let earnedEigenLayerPoint = userGroupMlrtPools[i].totalTvl.times(timeDiff).times(EIGEN_LAYER_POINT_PER_SEC).div(ETHER_ONE)
                userGroupMlrtPools[i].accumulateEigenLayerPoints = userGroupMlrtPools[i].accumulateEigenLayerPoints.plus(earnedEigenLayerPoint)
                userGroupMlrtPools[i].accEigenLayerPointPerShare = (userGroupMlrtPools[i].totalTvl.gt(BIGINT_ZERO)) ? userGroupMlrtPools[i].accumulateEigenLayerPoints.times(ETHER_ONE).div(userGroupMlrtPools[i].totalTvl) : BIGINT_ZERO
                userGroupMlrtPools[i].lastUpdateTimestamp = blockTimestamp
                userGroupMlrtPools[i].save()
            }

            for (let i = 0; i < referrerGroupMlrtPools.length; i++) {
                let mlrtAddress = referrerGroupMlrtPools[i].mlrt
                let mlrt = MLRT.bind(Address.fromBytes(mlrtAddress))
                let try_exchangeRateToNative = mlrt.try_exchangeRateToNative()
                let exchangeRateToNative = (try_exchangeRateToNative.reverted) ? ETHER_ONE : try_exchangeRateToNative.value

                referrerGroupMlrtPools[i].totalTvl = referrerGroupMlrtPools[i].totalAmount.times(exchangeRateToNative).div(ETHER_ONE)
                let timeDiff = referrerGroupMlrtPools[i].lastUpdateTimestamp.minus(blockTimestamp)
                let earnedEigenLayerPoint = referrerGroupMlrtPools[i].totalTvl.times(timeDiff).times(EIGEN_LAYER_POINT_PER_SEC).div(ETHER_ONE)
                referrerGroupMlrtPools[i].accumulateEigenLayerPoints = referrerGroupMlrtPools[i].accumulateEigenLayerPoints.plus(earnedEigenLayerPoint)
                referrerGroupMlrtPools[i].accEigenLayerPointPerShare = (referrerGroupMlrtPools[i].totalTvl.gt(BIGINT_ZERO)) ? referrerGroupMlrtPools[i].accumulateEigenLayerPoints.times(ETHER_ONE).div(referrerGroupMlrtPools[i].totalTvl) : BIGINT_ZERO
                referrerGroupMlrtPools[i].lastUpdateTimestamp = blockTimestamp
                referrerGroupMlrtPools[i].save()
            }

            let userGroupMembers = userGroup.members.load()
            for (let i = 0; i < userGroupMembers.length; i++) {
                let member = UserData.load(userGroupMembers[i].id)!
                member.referralGroup = referrerGroup.id
                member.save()
                let mLrtPools = member.mLrtPools.load()
                for (let j = 0; j < mLrtPools.length; j++) {
                    let mlrt = MLRT.bind(Address.fromBytes(mLrtPools[j].mlrt))
                    let mlrtPoolStatus = loadOrCreateGroupMlrtPoolStatus(userGroup.id, mLrtPools[j].mlrt)
                    // update eigenlayer points
                    let userPoolDepositData = loadOrCreateUserDepositData(member.id, mlrt.underlyingAsset() as Bytes, mLrtPools[j].mlrt)
                    userPoolDepositData.eigenLayerPoints = userPoolDepositData.mlrtAmount.times(mlrtPoolStatus.accEigenLayerPointPerShare).div(ETHER_ONE)
                        .plus(userPoolDepositData.eigenLayerPoints)
                    // update eigenpie points
                    userPoolDepositData.eigenpiePoints = userPoolDepositData.mlrtAmount.plus(userPoolDepositData.unmintedMlrt).times(mlrtPoolStatus.accEigenpiePointPerShare).div(ETHER_ONE)
                        .plus(userPoolDepositData.eigenpiePoints)
                    userPoolDepositData.save()
                }
            }

            for (let i = 0; i < userGroupMlrtPools.length; i++) {
                let mlrtAddress = userGroupMlrtPools[i].mlrt
                let groupMlrtPoolStatusToMerge = loadOrCreateGroupMlrtPoolStatus(referrerGroup.id, mlrtAddress)
                groupMlrtPoolStatusToMerge.totalTvl = groupMlrtPoolStatusToMerge.totalTvl.plus(userGroupMlrtPools[i].totalTvl)
                groupMlrtPoolStatusToMerge.totalAmount = groupMlrtPoolStatusToMerge.totalAmount.plus(userGroupMlrtPools[i].totalAmount)
                groupMlrtPoolStatusToMerge.totalUnmintedMlrt = groupMlrtPoolStatusToMerge.totalUnmintedMlrt.plus(userGroupMlrtPools[i].totalUnmintedMlrt)
                groupMlrtPoolStatusToMerge.lastUpdateTimestamp = blockTimestamp
                groupMlrtPoolStatusToMerge.save()

                store.remove("GroupMlrtPoolStatus", userGroupMlrtPools[i].id.toHexString()) // remove useless pool status from store
            }

            store.remove("ReferralGroup", userGroup.id.toHexString()) // remove empty group from store
            userGroup = referrerGroup // re-assign referrer's group as user's group
            let newGroupBoost = calEigenpiePointGroupBoost(userGroup.mlrtPoolStatus.load())
            userGroup.groupTVL = newGroupBoost[0]
            userGroup.groupBoost = newGroupBoost[1]
            userGroup.save()

            let referralStatus = loadReferralStatus()
            referralStatus.totalGroups--
            referralStatus.save()
        }
    }

    // 
}