import { Address, BigInt, Bytes, crypto } from "@graphprotocol/graph-ts"
import { DENOMINATOR, ADDRESS_ZERO, BIGINT_ZERO, ETHER_ONE, EIGEN_POINT_LAUNCH_TIME, BYTES_ZERO } from "./constants"
import { MLRT } from "../generated/templates/MLRT/MLRT"
import { UserData, ReferralGroup, ReferralStatus, UserPoolDepositData, GroupMlrtPoolStatus } from "../generated/schema"

export function loadOrCreateUserData(userAddress: Bytes, referrerAddr: Bytes = ADDRESS_ZERO): UserData {
    let user = UserData.load(userAddress)
    if (!user) {
        let referrer: UserData | null = null
        let referralGroup: ReferralGroup
        if (referrerAddr.notEqual(ADDRESS_ZERO) && referrerAddr.notEqual(userAddress)) {
            referrer = loadOrCreateUserData(referrerAddr)
            referralGroup = loadOrCreateReferralGroup(referrer.referralGroup)
            referrer.referralCount++
            referrer.save()
        } else {
            referralGroup = loadOrCreateReferralGroup(userAddress)
        }
        user = new UserData(userAddress)
        user.referrer = (referrer) ? referrer.id : ADDRESS_ZERO
        user.referralGroup = referralGroup.id
        user.referralCount = 0

        user.save()

        let referralStatus = loadReferralStatus()
        referralStatus.totalUsers++
        referralStatus.save()
    }
    return user
}

export function loadOrCreateReferralGroup(groupID: Bytes): ReferralGroup {
    let group = ReferralGroup.load(groupID)
    if (!group) {
        group = new ReferralGroup(groupID)
        group.groupTVL = BIGINT_ZERO
        group.groupBoost = DENOMINATOR
        group.save()

        let referralStatus = loadReferralStatus()
        referralStatus.totalGroups++
        referralStatus.save()
    }
    return group
}

export function loadOrCreateUserDepositData(userAddress: Bytes, assetAddress: Bytes, mlrtAddress: Bytes): UserPoolDepositData {
    let userPoolDepositData = UserPoolDepositData.load(userAddress.concat(assetAddress))

    if (!userPoolDepositData) {
        userPoolDepositData = new UserPoolDepositData(userAddress.concat(assetAddress))
        userPoolDepositData.user = userAddress
        userPoolDepositData.mlrt = mlrtAddress
        userPoolDepositData.amount = BIGINT_ZERO
        userPoolDepositData.unmintedMlrt = BIGINT_ZERO
        userPoolDepositData.eigenLayerPoints = BIGINT_ZERO
        userPoolDepositData.eigenLayerPointsDebt = BIGINT_ZERO
        userPoolDepositData.eigenpiePoints = BIGINT_ZERO
        userPoolDepositData.eigenpiePointsDebt = BIGINT_ZERO
        userPoolDepositData.save()
    }

    return userPoolDepositData
}

export function loadOrCreateGroupMlrtPoolStatus(groupId: Bytes, mlrtAddress: Bytes): GroupMlrtPoolStatus {
    let mlrtPoolStatus = GroupMlrtPoolStatus.load(groupId.concat(mlrtAddress))

    if (!mlrtPoolStatus) {
        mlrtPoolStatus = new GroupMlrtPoolStatus(mlrtAddress)
        mlrtPoolStatus.group = groupId
        mlrtPoolStatus.mlrt = mlrtAddress
        mlrtPoolStatus.totalTvl = BIGINT_ZERO
        mlrtPoolStatus.totalAmount = BIGINT_ZERO
        mlrtPoolStatus.totalUnmintedTvl = BIGINT_ZERO
        mlrtPoolStatus.totalUnmintedMlrt = BIGINT_ZERO
        mlrtPoolStatus.accumulateEigenLayerPoints = BIGINT_ZERO
        mlrtPoolStatus.accumulateEigenpiePoints = BIGINT_ZERO
        mlrtPoolStatus.accEigenLayerPointPerShare = BIGINT_ZERO
        mlrtPoolStatus.accEigenpiePointPerShare = BIGINT_ZERO
        mlrtPoolStatus.lastUpdateTimestamp = BIGINT_ZERO
        mlrtPoolStatus.save()
    }

    return mlrtPoolStatus
}

export function loadReferralStatus(): ReferralStatus {
    let referralStatus = ReferralStatus.load(BYTES_ZERO)

    if (!referralStatus) {
        referralStatus = new ReferralStatus(BYTES_ZERO)
        referralStatus.totalUsers = 0
        referralStatus.totalGroups = 0
        referralStatus.save()
    }

    return referralStatus
}