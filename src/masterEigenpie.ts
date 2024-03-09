import { Address, BigInt, Bytes, log, store } from "@graphprotocol/graph-ts";
import { Transfer as CurveLpTransferEvent, TokenExchange as CurveLpTokenExchangeEvent, AddLiquidity as CurveLpAddLiquidityEvent, RemoveLiquidity as CurveLpRemoveLiquidityEvent, RemoveLiquidityOne as CurveLpRemoveLiquidityOneEvent, RemoveLiquidityImbalance as CurveLpRemoveLiquidityImbalanceEvent, CurveLP } from "../generated/CurveLP-mst-wstETH/CurveLP"
import { Transfer as MlrtTransferEvent } from "../generated/templates/MLRT/MLRT"
import { AssetDeposit as AssetDepositEventV1, AssetDeposit1 as AssetDepositEventV2 } from "../generated/EigenpieStaking/EigenpieStaking"
import { ExchangeRateUpdate as PriceProviderExchangeRateUpdateEvent } from "../generated/PriceProvider/PriceProvider"
import { GlobalInfo, GroupInfo, LpInfo, PoolInfo, UserBalanceInfo, UserInfo } from "../generated/schema";
import { ADDRESS_ZERO, BIGINT_ONE, BIGINT_TWO, BIGINT_ZERO, BYTES_ZERO, DENOMINATOR, EIGENPIE_PREDEPLOST_HELPER, EIGEN_LAYER_LAUNCH_TIME, EIGEN_LAYER_POINT_PER_SEC, ETHER_ONE, ETHER_TEN, LPTOKEN_LIST, LST_PRICE_MAP, LST_TO_MLRT_MAP, MSTETH_WSTETH_CURVE_LP, MSWETH_SWETH_CURVE_LP } from "./constants";

// ################################# Curve LP ######################################## //
export function handleCurveLpTransfer(event: CurveLpTransferEvent): void {
    const lpToken = toLowerCase(event.address);
    const transferShares = event.params.value;
    const senderAddress = toLowerCase(event.params.sender);
    const receiverAddress = toLowerCase(event.params.receiver);

    // process for sender
    if (senderAddress.notEqual(ADDRESS_ZERO)) {
        const senderInfo = loadOrCreateGroupInfo(senderAddress);
        withdraw(senderInfo.group, lpToken, senderAddress, transferShares, event.block.timestamp, false);
    }
    
    // process for receiver
    if (receiverAddress.notEqual(ADDRESS_ZERO)) {
        const receiverInfo = loadOrCreateGroupInfo(senderAddress);
        deposit(receiverInfo.group, lpToken, receiverAddress, transferShares, event.block.timestamp, false);
    }
    updateGlobalBoost(event.block.timestamp);
}

export function handleCurveTrading(event: CurveLpTokenExchangeEvent): void {
    const lpToken = toLowerCase(event.address);
    log.debug("{}", ["1"]);
    updatePools(lpToken, event.block.timestamp);
    log.debug("{}", ["2"]);
    updateLpMlrtRatio(lpToken);
    log.debug("{}", ["3"]);
    updateGlobalBoost(event.block.timestamp);
    log.debug("{}", ["4"]);
}

function updateLpMlrtRatio(lpToken: Bytes): void {
    const CurveLpContract = CurveLP.bind(Address.fromBytes(lpToken));
    log.debug("{}", ["2.1"]);
    const mLrtToken = toLowerCase(CurveLpContract.coins(BIGINT_ZERO));
    const lstToken = toLowerCase(CurveLpContract.coins(BIGINT_ONE));
    log.debug("{}", ["2.2"]);
    let balances = CurveLpContract.get_balances();
    let mLRTTvl = mul(balances[0], loadOrCreateLpInfo(mLrtToken).priceToETH)
    log.debug("{}", ["2.3"]);
    LST_PRICE_MAP.keys().forEach((key: string): void => {
        let value = LST_PRICE_MAP.get(key);
        log.info('Key: {} - Value: {}', [key, value.toString()]);
      });
    log.debug("lstToken.toHexString(): {}", [lstToken.toHexString()]);
    log.debug("LST_PRICE_MAP.has(lstToken.toHexString()): {}", [LST_PRICE_MAP.has(lstToken.toHexString()).toString()]);
    let lstTvl = mul(balances[1], LST_PRICE_MAP.get(lstToken.toHexString()));
    log.debug("{}", ["2.4"]);
    const lpInfo = loadOrCreateLpInfo(lpToken);
    lpInfo.mLrtRatio = div(mLRTTvl, mLRTTvl.plus(lstTvl));
    lpInfo.save();
}

export function handleCurveAddLiquidity(event: CurveLpAddLiquidityEvent): void {
    const lpToken = toLowerCase(event.address);
    updatePools(lpToken, event.block.timestamp);
    updateLpMlrtRatio(lpToken);
    updateGlobalBoost(event.block.timestamp);
}

export function handleCurveRemoveLiquidity(event: CurveLpRemoveLiquidityEvent): void {
    const lpToken = toLowerCase(event.address);
    updatePools(lpToken, event.block.timestamp);
    updateLpMlrtRatio(lpToken);
    updateGlobalBoost(event.block.timestamp);
}

export function handleCurveRemoveLiquidityOne(event: CurveLpRemoveLiquidityOneEvent): void {
    const lpToken = toLowerCase(event.address);
    updatePools(lpToken, event.block.timestamp);
    updateLpMlrtRatio(lpToken);
    updateGlobalBoost(event.block.timestamp);
}

export function handleCurveRemoveLiquidityImbalance(event: CurveLpRemoveLiquidityImbalanceEvent): void {
    const lpToken = toLowerCase(event.address);
    updatePools(lpToken, event.block.timestamp);
    updateLpMlrtRatio(lpToken);
    updateGlobalBoost(event.block.timestamp);
}

// ################################# mLRT ######################################## //
export function handleMlrtTransfer(event: MlrtTransferEvent): void {
    const lpToken = toLowerCase(event.address);
    const transferShares = event.params.value;
    const senderAddress = toLowerCase(event.params.from);
    const receiverAddresss = toLowerCase(event.params.to);

    // process for sender
    if (senderAddress.notEqual(ADDRESS_ZERO) && !isStringEqualIgnoreCase(senderAddress.toHexString(), EIGENPIE_PREDEPLOST_HELPER)) {
        const senderInfo = loadOrCreateGroupInfo(senderAddress);
        withdraw(senderInfo.group, lpToken, senderAddress, transferShares, event.block.timestamp, false);
    }

    // process for receiver
    if (receiverAddresss.notEqual(ADDRESS_ZERO) &&  !isStringEqualIgnoreCase(receiverAddresss.toHexString(), EIGENPIE_PREDEPLOST_HELPER)) {
        const receiverInfo = loadOrCreateGroupInfo(receiverAddresss);
        deposit(receiverInfo.group, lpToken, receiverAddresss, transferShares, event.block.timestamp, false);
    }
    updateGlobalBoost(event.block.timestamp);
}

// ################################# EigenpieStaking ######################################## //
export function handleEigenpieStakingAssetDepositV1(event: AssetDepositEventV1): void {
    const referrerAddress = toLowerCase(event.params.referral);
    const depositorAddress = toLowerCase(event.params.depositor);
    const referrer = loadOrCreateUserInfo(referrerAddress);
    const depositor = loadOrCreateUserInfo(depositorAddress);
    if (isNewReferral(depositorAddress, referrerAddress)) {
        depositor.referrer = referrer.id;
        referrer.referralCount = referrer.referralCount.plus(ETHER_ONE);
        mergeGroups(depositor.group, referrer.group, event.block.timestamp, false);
    }
    updateGlobalBoost(event.block.timestamp);
}

export function handleEigenpieStakingAssetDepositV2(event: AssetDepositEventV2): void {
    const referrerAddress = toLowerCase(event.params.referral);
    const depositorAddress = toLowerCase(event.params.depositor);
    const isPreDepsoit = event.params.isPreDepsoit;
    const lpToken = Bytes.fromHexString(LST_TO_MLRT_MAP.get(event.params.asset.toHexString().toLowerCase()));
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
    let lpToken = toLowerCase(event.params.receipt);
    updatePools(lpToken, event.block.timestamp);
    let lstToken = toLowerCase(event.params.asset);
    let lpTokenPriceToLstToken = event.params.newExchangeRate;
    let lpTokenPriceToEth = mul(lpTokenPriceToLstToken, LST_PRICE_MAP.get(lstToken.toHexString().toLowerCase()));
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
        let timeSinceLastRewardUpdate = blockTimestamp.minus(pool.lastRewardTimestamp.le(EIGEN_LAYER_LAUNCH_TIME) ? EIGEN_LAYER_LAUNCH_TIME : pool.lastRewardTimestamp);
        // eigenLayerPointsReward = timeSinceLastRewardUpdate * lpInfo.eigenLayerPointsPerSec * lpInfo.priceToETH * lpInfo.totalShares * lpInfo.mLrtRatio
        let eigenLayerPointsReward = mul(mul(mul(mul(timeSinceLastRewardUpdate, lpInfo.eigenLayerPointsPerSec), lpInfo.priceToETH), pool.totalShares), lpInfo.mLrtRatio); 
        pool.accEigenLayerPointPerShare = pool.accEigenLayerPointPerShare.plus(div(eigenLayerPointsReward, pool.totalShares));
    }

    // update eigenpie points for pool
    let groupInfo = loadOrCreateGroupInfo(group);
    let globalInfo = loadOrCreateGlobalInfo();
    let timeSinceLastRewardUpdate = blockTimestamp.minus(pool.lastRewardTimestamp);
    // eigenpiePointsReward = timeSinceLastRewardUpdate * lpInfo.eigenpiePointsPerSec * lpInfo.priceToETH * (lpInfo.totalShares + lpInfo.totalUnclaimedShares) * groupInfo.groupBoost * globalInfo.globalBoost
    let eigenpiePointsReward = mul(mul(mul(mul(mul(timeSinceLastRewardUpdate, lpInfo.eigenpiePointsPerSec), lpInfo.priceToETH), pool.totalShares.plus(pool.totalUnclaimedShares)), groupInfo.groupBoost), globalInfo.globalBoost)
    pool.accEigenLayerPointPerShare = pool.accEigenLayerPointPerShare.plus(div(eigenpiePointsReward, pool.totalShares.plus(pool.totalUnclaimedShares)));
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
    userBalanceInfo.eigenLayerPointsDebt = mul(userBalanceInfo.shares, pool.accEigenLayerPointPerShare);
    userBalanceInfo.eigenpiePointsDebt = mul(userBalanceInfo.shares.plus(userBalanceInfo.unclaimedShares), pool.accEigenpiePointPerShare);

    // update group boost
    let group = loadOrCreateGroupInfo(groupAddress);
    let depositTvl = mul(shares, loadOrCreateLpInfo(lpToken).priceToETH);
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

    userBalanceInfo.eigenLayerPointsDebt = mul(userBalanceInfo.shares, pool.accEigenLayerPointPerShare);
    userBalanceInfo.eigenpiePointsDebt = mul(userBalanceInfo.shares.plus(userBalanceInfo.unclaimedShares), pool.accEigenpiePointPerShare);

    // update group boost
    let group = loadOrCreateGroupInfo(groupAddrss);
    let depositTvl = mul(shares, loadOrCreateLpInfo(lpToken).priceToETH);
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
    let pendingEigenLayerPoints = mul(userBalanceInfo.shares, pool.accEigenLayerPointPerShare).minus(userBalanceInfo.eigenLayerPointsDebt);
    return pendingEigenLayerPoints;
}

function calNewEigenpiePoints(group: Bytes, lpToken: Bytes, user: Bytes): BigInt {
    let pool = loadOrCreatePoolInfo(group, lpToken);
    let userBalanceInfo = loadOrCreateUserBalanceInfo(group, lpToken, user);
    let pendingEigenpiePoints = mul(userBalanceInfo.shares.plus(userBalanceInfo.unclaimedShares), pool.accEigenpiePointPerShare).minus(userBalanceInfo.eigenpiePointsDebt);
    return pendingEigenpiePoints;
}

function loadOrCreatePoolInfo(group: Bytes, lpToken: Bytes): PoolInfo {
    group = toLowerCase(group);
    lpToken = toLowerCase(lpToken);
    let poolInfo = PoolInfo.load(group.concat(lpToken));

    if (!poolInfo) {
        poolInfo = new PoolInfo(group.concat(lpToken));
        poolInfo.group = group;
        poolInfo.lpToken = lpToken;
        poolInfo.totalShares = BIGINT_ZERO;
        poolInfo.totalUnclaimedShares = BIGINT_ZERO;
        poolInfo.accEigenLayerPointPerShare = BIGINT_ZERO;
        poolInfo.accEigenpiePointPerShare = BIGINT_ZERO;
        poolInfo.lastRewardTimestamp = BIGINT_ZERO;
        poolInfo.save();
    }

    return poolInfo;
}

function loadOrCreateLpInfo(lpToken: Bytes): LpInfo {
    lpToken = toLowerCase(lpToken);
    let lpInfo = LpInfo.load(lpToken);

    if (!lpInfo) {
        lpInfo = new LpInfo(lpToken);
        lpInfo.lpToken = lpToken;
        lpInfo.priceToETH = ETHER_ONE;
        lpInfo.mLrtRatio = ETHER_ONE;
        lpInfo.eigenLayerPointsPerSec = EIGEN_LAYER_POINT_PER_SEC;
        lpInfo.eigenpiePointsPerSec = getEigenpiePointsPerSec(lpToken);
        lpInfo.save();
    }

    return lpInfo;
}

function loadOrCreateUserBalanceInfo(group: Bytes, lpToken: Bytes, user: Bytes): UserBalanceInfo {
    group = toLowerCase(group);
    lpToken = toLowerCase(lpToken);
    user = toLowerCase(user);
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
    user = toLowerCase(user);
    let userInfo = UserInfo.load(user);

    if (!userInfo) {
        userInfo = new UserInfo(user);
        userInfo.user = user;
        userInfo.referrer = BYTES_ZERO;
        userInfo.referralCount = BIGINT_ZERO;
        userInfo.group = user;
        userInfo.eigenLayerPoints = BIGINT_ZERO;
        userInfo.eigenpiePoints = BIGINT_ZERO;
        userInfo.eigenpieReferralPoints = BIGINT_ZERO;
        userInfo.save();
    }

    return userInfo;
}

function loadOrCreateGroupInfo(group: Bytes): GroupInfo {
    group = toLowerCase(group);
    let groupInfo = GroupInfo.load(group);

    if (!groupInfo) {
        groupInfo = new GroupInfo(group);
        groupInfo.group = group;
        groupInfo.totalTvl = BIGINT_ZERO;
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
    if (isStringEqualIgnoreCase(lpToken.toHexString(), MSTETH_WSTETH_CURVE_LP) || isStringEqualIgnoreCase(lpToken.toHexString(), MSWETH_SWETH_CURVE_LP)) {
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
        let lpInfo = loadOrCreateLpInfo(Bytes.fromHexString(LPTOKEN_LIST[i]));
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

function isStringEqualIgnoreCase(str1: string, str2: string): bool {
    return str1.toLowerCase() == str2.toLowerCase();
}

function toLowerCase(address: Bytes): Bytes {
    return Bytes.fromHexString(address.toHexString().toLowerCase());
}


// ################################# Math Utils ######################################## //
function mul(a: BigInt, b: BigInt): BigInt {
    return a.times(b).div(ETHER_ONE);
}

function div(a: BigInt, b: BigInt): BigInt {
    return a.times(ETHER_ONE).div(b);
}