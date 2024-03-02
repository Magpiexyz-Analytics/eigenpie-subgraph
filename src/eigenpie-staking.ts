import { Address, BigInt, store } from "@graphprotocol/graph-ts"
import { AssetDeposit as AssetDepositEvent, EigenpieStaking } from "../generated/EigenpieStaking/EigenpieStaking"
import { ReferralGroup, UserData } from "../generated/schema"
import { EigenpieConfig } from "../generated/EigenpieConfig/EigenpieConfig"
import { MLRT } from "../generated/templates/MLRT/MLRT"
import { ADDRESS_ZERO, BIGINT_ZERO, EIGEN_LAYER_POINT_PER_SEC, ETHER_ONE } from "./constants"
import { loadOrCreateGroupMlrtPoolStatus, loadOrCreateReferralGroup, loadOrCreateUserData, loadOrCreateUserDepositData, loadReferralStatus } from "./entity-operations"
import { calEigenpiePointGroupBoost } from "./boost-module"

export function handleAssetDeposit(event: AssetDepositEvent): void {
    // update the referral info if user's referrer was updated
    if (event.params.referral.notEqual(ADDRESS_ZERO)) {
        let userData = loadOrCreateUserData(event.params.depositor, event.params.referral) // try to update the referrer
        let referrerData = loadOrCreateUserData(userData.referrer, ADDRESS_ZERO)

        if (userData.referralGroup.notEqual(referrerData.referralGroup)) {
            // if the user and the referrer are not in the same group, merge them
            let userGroup = loadOrCreateReferralGroup(userData.referralGroup)
            let referrerGroup = loadOrCreateReferralGroup(referrerData.referralGroup)

            let userGroupMlrtPools = userGroup.mlrtPoolStatus.load()
            let referrerGroupMlrtPools = referrerGroup.mlrtPoolStatus.load()
            for (let i = 0; i < userGroupMlrtPools.length; i++) {
                let mlrtAddress = userGroupMlrtPools[i].mlrt
                let mlrt = MLRT.bind(mlrtAddress as Address)
                let try_exchangeRateToNative = mlrt.try_exchangeRateToNative()
                let exchangeRateToNative = (try_exchangeRateToNative.reverted) ? ETHER_ONE : try_exchangeRateToNative.value

                userGroupMlrtPools[i].totalTvl = userGroupMlrtPools[i].totalAmount.times(exchangeRateToNative).div(ETHER_ONE)
                let timeDiff = userGroupMlrtPools[i].lastUpdateTimestamp.minus(event.block.timestamp)
                let earnedEigenLayerPoint = userGroupMlrtPools[i].totalTvl.times(timeDiff).times(EIGEN_LAYER_POINT_PER_SEC).div(ETHER_ONE)
                userGroupMlrtPools[i].accumulateEigenLayerPoints = userGroupMlrtPools[i].accumulateEigenLayerPoints.plus(earnedEigenLayerPoint)
                userGroupMlrtPools[i].accEigenLayerPointPerShare = userGroupMlrtPools[i].accumulateEigenLayerPoints.times(ETHER_ONE).div(userGroupMlrtPools[i].totalTvl)
                userGroupMlrtPools[i].lastUpdateTimestamp = event.block.timestamp
                userGroupMlrtPools[i].save()
            }

            for (let i = 0; i < referrerGroupMlrtPools.length; i++) {
                let mlrtAddress = referrerGroupMlrtPools[i].mlrt
                let mlrt = MLRT.bind(mlrtAddress as Address)
                let try_exchangeRateToNative = mlrt.try_exchangeRateToNative()
                let exchangeRateToNative = (try_exchangeRateToNative.reverted) ? ETHER_ONE : try_exchangeRateToNative.value

                referrerGroupMlrtPools[i].totalTvl = referrerGroupMlrtPools[i].totalAmount.times(exchangeRateToNative).div(ETHER_ONE)
                let timeDiff = referrerGroupMlrtPools[i].lastUpdateTimestamp.minus(event.block.timestamp)
                let earnedEigenLayerPoint = referrerGroupMlrtPools[i].totalTvl.times(timeDiff).times(EIGEN_LAYER_POINT_PER_SEC).div(ETHER_ONE)
                referrerGroupMlrtPools[i].accumulateEigenLayerPoints = referrerGroupMlrtPools[i].accumulateEigenLayerPoints.plus(earnedEigenLayerPoint)
                referrerGroupMlrtPools[i].accEigenLayerPointPerShare = referrerGroupMlrtPools[i].accumulateEigenLayerPoints.times(ETHER_ONE).div(referrerGroupMlrtPools[i].totalTvl)
                referrerGroupMlrtPools[i].lastUpdateTimestamp = event.block.timestamp
                referrerGroupMlrtPools[i].save()
            }

            for (let i = 0; i < userGroupMlrtPools.length; i++) {
                let mlrtAddress = userGroupMlrtPools[i].mlrt
                let groupMlrtPoolStatusToMerge = loadOrCreateGroupMlrtPoolStatus(referrerGroup.id, mlrtAddress)
                groupMlrtPoolStatusToMerge.totalTvl = groupMlrtPoolStatusToMerge.totalTvl.plus(userGroupMlrtPools[i].totalTvl)
                groupMlrtPoolStatusToMerge.totalAmount = groupMlrtPoolStatusToMerge.totalAmount.plus(userGroupMlrtPools[i].totalAmount)
                groupMlrtPoolStatusToMerge.totalUnmintedMlrt = groupMlrtPoolStatusToMerge.totalUnmintedMlrt.plus(userGroupMlrtPools[i].totalUnmintedMlrt)
                groupMlrtPoolStatusToMerge.accumulateEigenLayerPoints = groupMlrtPoolStatusToMerge.accumulateEigenLayerPoints.plus(userGroupMlrtPools[i].accumulateEigenLayerPoints)
                groupMlrtPoolStatusToMerge.accumulateEigenpiePoints = groupMlrtPoolStatusToMerge.accumulateEigenpiePoints.plus(userGroupMlrtPools[i].accumulateEigenpiePoints)
                groupMlrtPoolStatusToMerge.accEigenLayerPointPerShare = groupMlrtPoolStatusToMerge.accumulateEigenLayerPoints.times(ETHER_ONE).div(groupMlrtPoolStatusToMerge.totalTvl)
                groupMlrtPoolStatusToMerge.accEigenLayerPointPerShare = groupMlrtPoolStatusToMerge.accumulateEigenLayerPoints.times(ETHER_ONE).div(groupMlrtPoolStatusToMerge.totalTvl)
                groupMlrtPoolStatusToMerge.lastUpdateTimestamp = event.block.timestamp
                groupMlrtPoolStatusToMerge.save()

                store.remove("GroupMlrtPoolStatus", referrerGroupMlrtPools[i].id.toHexString()) // remove useless pool status from store
            }

            let userGroupMembers = userGroup.members.load()
            for (let i = 0; i < userGroupMembers.length; i++) {
                let member = UserData.load(userGroupMembers[i].id)!
                member.referralGroup = referrerGroup.id
                member.save()
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