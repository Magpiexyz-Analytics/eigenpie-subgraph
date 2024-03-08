import { BigInt, Bytes, store } from "@graphprotocol/graph-ts";
import { Transfer as CurveLpTransferEvent, TokenExchange as CurveLpTokenExchangeEvent, AddLiquidity as CurveLpAddLiquidityEvent, RemoveLiquidity as CurveLpRemoveLiquidityEvent, RemoveLiquidityOne as CurveLpRemoveLiquidityOneEvent, RemoveLiquidityImbalance as CurveLpRemoveLiquidityImbalanceEvent, CurveLP } from "../generated/CurveLP-mst-wstETH/CurveLP"
import { Transfer as MlrtTransferEvent } from "../generated/templates/MLRT/MLRT"
import { AssetDeposit as AssetDepositEventV1, AssetDeposit1 as AssetDepositEventV2 } from "../generated/EigenpieStaking/EigenpieStaking"
import { ExchangeRateUpdate as PriceProviderExchangeRateUpdateEvent } from "../generated/PriceProvider/PriceProvider"
import { GlobalInfo, GroupInfo, LpInfo, PoolInfo, UserBalanceInfo, UserInfo } from "../generated/schema";
import { ADDRESS_ZERO, BIGINT_ONE, BIGINT_TWO, BIGINT_ZERO, BYTES_ZERO, DENOMINATOR, EIGENPIE_PREDEPLOST_HELPER, EIGEN_LAYER_LAUNCH_TIME, EIGEN_LAYER_POINT_PER_SEC, ETHER_ONE, ETHER_TEN, LPTOKEN_LIST, LST_PRICE_MAP, LST_TO_MLRT_MAP, MSTETH_WSTETH_CURVE_LP, MSWETH_SWETH_CURVE_LP } from "./constants";

// ################################# Curve LP ######################################## //
export function handleCurveLpTransfer(event: CurveLpTransferEvent): void {
    const lpToken = event.address;
    const transferShares = event.params.value;

    // process for sender
    if (event.params.sender.notEqual(ADDRESS_ZERO)) {
        const senderInfo = loadOrCreateGroupInfo(event.params.sender);
        withdraw(senderInfo.group, lpToken, event.params.sender, transferShares, event.block.timestamp, false);
    }
    
    // process for receiver
    if (event.params.receiver.notEqual(ADDRESS_ZERO)) {
        const receiverInfo = loadOrCreateGroupInfo(event.params.sender);
        deposit(receiverInfo.group, lpToken, event.params.receiver, transferShares, event.block.timestamp, false);
    }
    updateGlobalBoost(event.block.timestamp);
}

export function handleCurveTrading(event: CurveLpTokenExchangeEvent): void {
    const lpToken = event.address;
    updatePools(lpToken, event.block.timestamp);
    updateLpMlrtRatio(lpToken);
    updateGlobalBoost(event.block.timestamp);
}

function updateLpMlrtRatio(lpToken: Bytes): void {
    const CurveLpContract = CurveLP.bind(lpToken);
    const mLrtToken = CurveLpContract.coins(BIGINT_ZERO);
    const lstToken = CurveLpContract.coins(BIGINT_ONE);
    let balances = CurveLpContract.get_balances();
    let mLRTTvl = balances[0].times(loadOrCreateLpInfo(mLrtToken).priceToETH).div(ETHER_ONE);
    let lstTvl = balances[1].times(LST_PRICE_MAP.get(lstToken));
    const lpInfo = loadOrCreateLpInfo(lpToken);
    lpInfo.mLrtRatio = mLRTTvl.times(ETHER_ONE).div(mLRTTvl.plus(lstTvl));
    lpInfo.save();
}

export function handleCurveAddLiquidity(event: CurveLpAddLiquidityEvent): void {
    const lpToken = event.address;
    updatePools(lpToken, event.block.timestamp);
    updateLpMlrtRatio(lpToken);
    updateGlobalBoost(event.block.timestamp);
}

export function handleCurveRemoveLiquidity(event: CurveLpRemoveLiquidityEvent): void {
    const lpToken = event.address;
    updatePools(lpToken, event.block.timestamp);
    updateLpMlrtRatio(lpToken);
    updateGlobalBoost(event.block.timestamp);
}

export function handleCurveRemoveLiquidityOne(event: CurveLpRemoveLiquidityOneEvent): void {
    const lpToken = event.address;
    updatePools(lpToken, event.block.timestamp);
    updateLpMlrtRatio(lpToken);
    updateGlobalBoost(event.block.timestamp);
}

export function handleCurveRemoveLiquidityImbalance(event: CurveLpRemoveLiquidityImbalanceEvent): void {
    const lpToken = event.address;
    updatePools(lpToken, event.block.timestamp);
    updateLpMlrtRatio(lpToken);
    updateGlobalBoost(event.block.timestamp);
}

// ################################# mLRT ######################################## //
export function handleTransfer(event: MlrtTransferEvent): void {
    const lpToken = event.address;
    const transferShares = event.params.value;

    // process for sender
    if (event.params.from.notEqual(ADDRESS_ZERO) && event.params.to.notEqual(EIGENPIE_PREDEPLOST_HELPER)) {
        const senderInfo = loadOrCreateGroupInfo(event.params.from);
        withdraw(senderInfo.group, lpToken, event.params.from, transferShares, event.block.timestamp, false);
    }

    // process for receiver
    if (event.params.to.notEqual(ADDRESS_ZERO) && event.params.to.notEqual(EIGENPIE_PREDEPLOST_HELPER)) {
        const receiverInfo = loadOrCreateGroupInfo(event.params.to);
        deposit(receiverInfo.group, lpToken, event.params.to, transferShares, event.block.timestamp, false);
    }
    updateGlobalBoost(event.block.timestamp);
}

// ################################# EigenpieStaking ######################################## //
export function handleAssetDepositV1(event: AssetDepositEventV1): void {
    const referrerAddress = event.params.referral;
    const depositorAddress = event.params.depositor;
    const referrer = loadOrCreateUserInfo(referrerAddress);
    const depositor = loadOrCreateUserInfo(depositorAddress);
    if (isNewReferral(depositorAddress, referrerAddress)) {
        depositor.referrer = referrer.id;
        referrer.referralCount = referrer.referralCount.plus(ETHER_ONE);
        mergeGroups(depositor.group, referrer.group, event.block.timestamp, false);
    }
    updateGlobalBoost(event.block.timestamp);
}

export function handleAssetDepositV2(event: AssetDepositEventV2): void {
    const referrerAddress = event.params.referral;
    const depositorAddress = event.params.depositor;
    const depositShares = event.params.depositAmount;
    const isPreDepsoit = event.params.isPreDepsoit;
    const lpToken = LST_TO_MLRT_MAP.get(event.params.asset);
    const shares = event.params.mintedAmount;
    const referrer = loadOrCreateUserInfo(referrerAddress);
    const depositor = loadOrCreateUserInfo(depositorAddress);
    if (isNewReferral(depositorAddress, referrerAddress)) {
        depositor.referrer = referrer.id;
        referrer.referralCount = referrer.referralCount.plus(ETHER_ONE);
        mergeGroups(depositor.group, referrer.group, event.block.timestamp, isPreDepsoit);
    }
    if (isPreDepsoit) {
        deposit(depositor.group, lpToken, depositorAddress, shares, event.block.timestamp, true);
    } else {
        deposit(depositor.group, lpToken, depositorAddress, shares, event.block.timestamp, false);
    }
    updateGlobalBoost(event.block.timestamp);
}

// ################################# PriceProvider ######################################## //
export function handlePriceProviderExchangeRateUpdateEvent(event: PriceProviderExchangeRateUpdateEvent): void {
    let lpToken = event.params.receipt;
    updatePools(lpToken, event.block.timestamp);
    let lstToken = event.params.asset;
    let lpTokenPriceToLstToken = event.params.newExchangeRate;
    let lpTokenPriceToEth = lpTokenPriceToLstToken.times(LST_PRICE_MAP.get(lstToken)).div(ETHER_ONE);
    let lpInfo = loadOrCreateLpInfo(lpToken);
    lpInfo.priceToETH = lpTokenPriceToEth;
    lpInfo.save();
}

// ################################# Helper Functions ######################################## //

function mergeGroups(depositorGroupAddress: Bytes, referrerGroupAddress: Bytes, blockTimestamp: BigInt, isPreDepsoit: bool): void {
    const depositorGroup = loadOrCreateGroupInfo(depositorGroupAddress);
    const members = depositorGroup.members.load();
    for (let i = 0; i < members.length; i++) {
        let member = members[i];
        let userBalances = member.userBalances.load();
        for (let j = 0; j < userBalances.length; i++) {
            let userBalance = userBalances[j];
            withdraw(depositorGroup.group, userBalance.lpToken, userBalance.user, userBalance.shares, blockTimestamp, isPreDepsoit);
            deposit(referrerGroupAddress, userBalance.lpToken, userBalance.user, userBalance.shares, blockTimestamp, isPreDepsoit);
            member.group = referrerGroupAddress;
            store.remove("UserBalanceInfo", userBalance.id.toHexString());
        }
    }
    store.remove("GroupInfo", depositorGroup.id.toHexString());
}

function isNewReferral(user: Bytes, referrer: Bytes): boolean {
    const userInfo = loadOrCreateUserInfo(user);
    return userInfo.referrer.equals(ADDRESS_ZERO) && referrer.notEqual(ADDRESS_ZERO) && referrer.notEqual(userInfo.id);
}

function updatePool(group: Bytes, lpToken: Bytes, blockTimestamp: BigInt): void {
    let pool = loadOrCreatePoolInfo(group, lpToken);
    if (blockTimestamp.le(pool.lastRewardTimestamp) || pool.totalShares.plus(pool.totalUnclaimedShares).equals(BIGINT_ZERO)) {
        pool.lastRewardTimestamp = blockTimestamp;
        pool.save();
        return;
    }
    let lpInfo = loadOrCreateLpInfo(pool.lpToken);
    // update eigenlayer points for pool
    if (blockTimestamp.gt(EIGEN_LAYER_LAUNCH_TIME)) {
        let eigenLayerPointsmultiplier = blockTimestamp.minus(pool.lastRewardTimestamp.le(EIGEN_LAYER_LAUNCH_TIME) ? EIGEN_LAYER_LAUNCH_TIME : pool.lastRewardTimestamp);
        let eigenLayerPointsReward = eigenLayerPointsmultiplier.times(lpInfo.eigenLayerPointsPerSec).div(ETHER_ONE).times(lpInfo.priceToETH).div(ETHER_ONE).times(pool.totalShares).div(ETHER_ONE).times(lpInfo.mLrtRatio).div(ETHER_ONE);
        pool.accEigenLayerPointPerShare = pool.accEigenLayerPointPerShare.plus(eigenLayerPointsReward.div(pool.totalShares));
    }

    // update eigenpie points for pool
    let groupInfo = loadOrCreateGroupInfo(group);
    let globalInfo = loadOrCreateGlobalInfo();
    let eigenpiePointsMultiplier = blockTimestamp.minus(pool.lastRewardTimestamp);
    let eigenpiePointsReward = eigenpiePointsMultiplier.times(lpInfo.eigenpiePointsPerSec).div(ETHER_ONE).times(lpInfo.priceToETH).div(ETHER_ONE).times((pool.totalShares.plus(pool.totalUnclaimedShares))).div(ETHER_ONE).times(groupInfo.groupBoost).div(ETHER_ONE).times(globalInfo.globalBoost).div(ETHER_ONE);
    pool.accEigenLayerPointPerShare = pool.accEigenLayerPointPerShare.plus(eigenpiePointsReward.times(ETHER_ONE).div(pool.totalShares.plus(pool.totalUnclaimedShares)));
    pool.lastRewardTimestamp = blockTimestamp;
    pool.save();
}    

function deposit(groupAddress: Bytes, lpToken: Bytes, user: Bytes, shares: BigInt, blockTimestamp: BigInt, isPreDepsoit: bool): void {
    updatePool(groupAddress, lpToken, blockTimestamp);

    let pool = loadOrCreatePoolInfo(groupAddress, lpToken);
    let userBalanceInfo = loadOrCreateUserBalanceInfo(groupAddress, lpToken, user);

    // harvest points for user
    if (userBalanceInfo.shares.plus(userBalanceInfo.unclaimedShares).lt(BIGINT_ZERO)) {
        harvestPoints(groupAddress, lpToken, user);
    }

    // update user balance and pool balance
    if (isPreDepsoit) {
        userBalanceInfo.unclaimedShares = userBalanceInfo.unclaimedShares.plus(shares);
        pool.totalUnclaimedShares = pool.totalUnclaimedShares.plus(shares);
    } else {
        userBalanceInfo.shares = userBalanceInfo.shares.plus(shares);
        pool.totalShares = pool.totalShares.plus(shares);
    }

    // update user point debt
    userBalanceInfo.eigenLayerPointsDebt = userBalanceInfo.shares.times(pool.accEigenLayerPointPerShare).div(ETHER_ONE);
    userBalanceInfo.eigenpiePointsDebt = (userBalanceInfo.shares.plus(userBalanceInfo.unclaimedShares)).times(pool.accEigenpiePointPerShare).div(ETHER_ONE);

    // update group boost
    let group = loadOrCreateGroupInfo(groupAddress);
    let depositTvl = shares.times(loadOrCreateLpInfo(lpToken).priceToETH).div(ETHER_ONE);
    group.totalTvl = group.totalTvl.plus(depositTvl);
    group.groupBoost = calEigenpiePointGroupBoost(group.totalTvl);
    
    userBalanceInfo.save()
    pool.save();
    group.save()
}

function withdraw(groupAddrss: Bytes, lpToken: Bytes, user: Bytes, shares: BigInt, blockTimestamp: BigInt, isPreDepsoit: bool): void {
    updatePool(groupAddrss, lpToken, blockTimestamp);

    let pool = loadOrCreatePoolInfo(groupAddrss, lpToken);
    let userBalanceInfo = loadOrCreateUserBalanceInfo(groupAddrss, lpToken, user);

    if ((!isPreDepsoit && userBalanceInfo.shares < shares) || (isPreDepsoit && userBalanceInfo.unclaimedShares < shares)) {
        throw new Error("WithdrawAmountExceedsStaked");
    } 

    harvestPoints(groupAddrss, lpToken, user);

    // update user balance and pool balance
    if (isPreDepsoit) {
        userBalanceInfo.unclaimedShares = userBalanceInfo.unclaimedShares.minus(shares);
        pool.totalUnclaimedShares = pool.totalUnclaimedShares.minus(shares);
    } else {
        userBalanceInfo.shares = userBalanceInfo.shares.minus(shares);
        pool.totalShares = pool.totalShares.minus(shares);
    }

    userBalanceInfo.eigenLayerPointsDebt = userBalanceInfo.shares.times(pool.accEigenLayerPointPerShare).div(ETHER_ONE);
    userBalanceInfo.eigenpiePointsDebt = (userBalanceInfo.shares.plus(userBalanceInfo.unclaimedShares)).times(pool.accEigenpiePointPerShare).div(ETHER_ONE);

    // update group boost
    let group = loadOrCreateGroupInfo(groupAddrss);
    let depositTvl = shares.times(loadOrCreateLpInfo(lpToken).priceToETH).div(ETHER_ONE);
    group.totalTvl = group.totalTvl.minus(depositTvl);
    group.groupBoost = calEigenpiePointGroupBoost(group.totalTvl);
    
    userBalanceInfo.save()
    pool.save();
    group.save()
}

function harvestPoints(group: Bytes, lpToken: Bytes, user: Bytes): void {
    let userInfo = loadOrCreateUserInfo(user);
    let referrerInfo = loadOrCreateUserInfo(userInfo.referrer);
    // Harvest EigenLayer Points
    let pendingEigenLayerPoints = calNewEigenLayerPoints(group, lpToken, user);
    userInfo.eigenLayerPoints = userInfo.eigenLayerPoints.plus(pendingEigenLayerPoints);
    
    // Harvest Eigenpie Points
    let pendingEigenpiePoints = calNewEigenpiePoints(group, lpToken, user);
    userInfo.eigenpiePoints = userInfo.eigenpiePoints.plus(pendingEigenpiePoints);
    referrerInfo.eigenpieReferralPoints = referrerInfo.eigenpieReferralPoints.plus(pendingEigenpiePoints.times(ETHER_ONE).div(ETHER_TEN));
    userInfo.save();
    referrerInfo.save();
}

function calNewEigenLayerPoints(group: Bytes, lpToken: Bytes, user: Bytes): BigInt {
    let pool = loadOrCreatePoolInfo(group, lpToken);
    let userBalanceInfo = loadOrCreateUserBalanceInfo(group, lpToken, user);
    let pendingEigenLayerPoints = userBalanceInfo.shares.times(pool.accEigenLayerPointPerShare).div(ETHER_ONE).minus(userBalanceInfo.eigenLayerPointsDebt);
    return pendingEigenLayerPoints;
}

function calNewEigenpiePoints(group: Bytes, lpToken: Bytes, user: Bytes): BigInt {
    let pool = loadOrCreatePoolInfo(group, lpToken);
    let userBalanceInfo = loadOrCreateUserBalanceInfo(group, lpToken, user);
    let pendingEigenpiePoints = (userBalanceInfo.shares.plus(userBalanceInfo.unclaimedShares)).times(pool.accEigenpiePointPerShare).div(ETHER_ONE).minus(userBalanceInfo.eigenpiePointsDebt);
    return pendingEigenpiePoints;
}

function loadOrCreatePoolInfo(group: Bytes, lpToken: Bytes): PoolInfo {
    let poolInfo = PoolInfo.load(group.concat(lpToken));

    if (!poolInfo) {
        poolInfo = new PoolInfo(group.concat(lpToken));
        poolInfo.group = group;
        poolInfo.lpToken = lpToken;
        poolInfo.totalShares = BIGINT_ZERO;
        poolInfo.accEigenLayerPointPerShare = BIGINT_ZERO;
        poolInfo.accEigenpiePointPerShare = BIGINT_ZERO;
        poolInfo.lastRewardTimestamp = BIGINT_ZERO;
        poolInfo.save();
    }

    return poolInfo;
}

function loadOrCreateLpInfo(lpToken: Bytes): LpInfo {
    let lpInfo = LpInfo.load(lpToken);

    if (!lpInfo) {
        lpInfo = new LpInfo(lpToken);
        lpInfo.lpToken = lpToken;
        lpInfo.mLrtRatio = ETHER_ONE;
        lpInfo.eigenLayerPointsPerSec = EIGEN_LAYER_POINT_PER_SEC;
        lpInfo.eigenpiePointsPerSec = getEigenpiePointsPerSec(lpToken);
        lpInfo.save();
    }

    return lpInfo;
}

function loadOrCreateUserBalanceInfo(group: Bytes, lpToken: Bytes, user: Bytes): UserBalanceInfo {
    let userBalanceInfo = UserBalanceInfo.load(group.concat(lpToken).concat(user));

    if (!userBalanceInfo) {
        userBalanceInfo = new UserBalanceInfo(group.concat(lpToken).concat(user));
        userBalanceInfo.group = group;
        userBalanceInfo.lpToken = lpToken;
        userBalanceInfo.user = user;
        userBalanceInfo.shares = BIGINT_ZERO;
        userBalanceInfo.unclaimedShares = BIGINT_ZERO;
        userBalanceInfo.eigenLayerPointsDebt = BIGINT_ZERO;
        userBalanceInfo.eigenpiePointsDebt = BIGINT_ZERO;
        userBalanceInfo.save();
    }

    return userBalanceInfo;
}

function loadOrCreateUserInfo(user: Bytes): UserInfo {
    let userInfo = UserInfo.load(user);

    if (!userInfo) {
        userInfo = new UserInfo(user);
        userInfo.user = user;
        userInfo.referrer = BYTES_ZERO;
        userInfo.save();
    }

    return userInfo;
}

function loadOrCreateGroupInfo(group: Bytes): GroupInfo {
    let groupInfo = GroupInfo.load(group);

    if (!groupInfo) {
        groupInfo = new GroupInfo(group);
        groupInfo.groupBoost = BIGINT_ONE;
        groupInfo.save();
    }

    return groupInfo;
}

function loadOrCreateGlobalInfo(): GlobalInfo {
    let globalInfo = GlobalInfo.load(BYTES_ZERO);

    if (!globalInfo) {
        globalInfo = new GlobalInfo(BYTES_ZERO);
        globalInfo.globalBoost = BIGINT_ONE;
        globalInfo.save();
    }

    return globalInfo;
}

function getEigenpiePointsPerSec(lpToken: Bytes): BigInt {
    if (lpToken.equals(MSTETH_WSTETH_CURVE_LP) || lpToken.equals(MSWETH_SWETH_CURVE_LP)) {
        return BigInt.fromString("2000000000000000000").div(BigInt.fromI32(3600))
    }
    return BigInt.fromString("1000000000000000000").div(BigInt.fromI32(3600))
}

function calEigenpiePointGroupBoost(groupTvl: BigInt): BigInt {
    let boostMultiplier = DENOMINATOR

    // Define TVL thresholds and their corresponding boost values
    const tvlThresholds: BigInt[] = [
        BigInt.fromI32(100).times(ETHER_ONE),
        BigInt.fromI32(500).times(ETHER_ONE),
        BigInt.fromI32(1000).times(ETHER_ONE),
        BigInt.fromI32(2000).times(ETHER_ONE),
        BigInt.fromI32(5000).times(ETHER_ONE)
    ]

    const boostValues = [12000, 14000, 16000, 18000, 20000]

    // Determine the boost multiplier based on the total TVL
    for (let i = tvlThresholds.length - 1; i >= 0; i--) {
        if (groupTvl.ge(tvlThresholds[i])) {
            boostMultiplier = BigInt.fromI32(boostValues[i])
            break
        }
    }

    return boostMultiplier;
}

function updateAllPools(blockTimestamp: BigInt): void {
    for (let i = 0; i < LPTOKEN_LIST.length; i++) {
        let lpInfo = loadOrCreateLpInfo(LPTOKEN_LIST[i]);
        let pools = lpInfo.pools.load();
        for (let j = 0; j < pools.length; j++) {
            let pool = pools[j];
            updatePool(pool.group, pool.lpToken, blockTimestamp);
        }
    }
}

function updatePools(lpToken: Bytes, blockTimestamp: BigInt): void {
    let lpInfo = loadOrCreateLpInfo(lpToken);
    let pools = lpInfo.pools.load();
    for (let j = 0; j < pools.length; j++) {
        let pool = pools[j];
        updatePool(pool.group, pool.lpToken, blockTimestamp);
    }
}

function updateGlobalBoost(blockTimestamp: BigInt): void {
    let globalInfo = loadOrCreateGlobalInfo();
    if (blockTimestamp.le(BigInt.fromI32(1707782400))) {
        // 2X global boost
        // Duration: from Eigenpie launche time to 2024/2/13 0:00 UTC
        if (globalInfo.globalBoost.notEqual(BIGINT_TWO)) {
            updateAllPools(blockTimestamp);
            globalInfo.globalBoost = BIGINT_TWO;
        }
    } else if (blockTimestamp.le(BigInt.fromI32(1708765200))) {
        // 1X global boost
        // Duration: from 2024/2/13 0:00 UTC to 2024/2/24 9:00 UTC
        if (globalInfo.globalBoost.notEqual(BIGINT_ONE)) {
            updateAllPools(blockTimestamp);
            globalInfo.globalBoost = BIGINT_ONE;
        }
    } else if (blockTimestamp.le(BigInt.fromI32(1709629200))) {
        // 2X global boost
        // Duration: from 2024/2/24 9:00 to 2024/3/5 9:00 UTC
        if (globalInfo.globalBoost.notEqual(BIGINT_TWO)) {
            updateAllPools(blockTimestamp);
            globalInfo.globalBoost = BIGINT_TWO;
        }
    } else {
        // 1X global boost
        // Duration: from 2024/3/5 9:00 UTC to future
        if (globalInfo.globalBoost.notEqual(BIGINT_ONE)) {
            updateAllPools(blockTimestamp);
            globalInfo.globalBoost = BIGINT_ONE;
        }
    }
    globalInfo.save();
}