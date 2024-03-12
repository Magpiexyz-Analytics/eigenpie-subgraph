import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts";
import { beforeAll, describe, newMockEvent, test } from "matchstick-as";
import { assert, clearStore, afterAll } from "matchstick-as/assembly/index";
import {
  Transfer as CurveLpTransferEvent,
  TokenExchange as CurveLpTokenExchangeEvent,
  AddLiquidity as CurveLpAddLiquidityEvent,
  RemoveLiquidity as CurveLpRemoveLiquidityEvent,
  RemoveLiquidityOne as CurveLpRemoveLiquidityOneEvent,
  RemoveLiquidityImbalance as CurveLpRemoveLiquidityImbalanceEvent,
  CurveLP,
  TokenExchange__Params,
  TokenExchange,
} from "../generated/CurveLP/CurveLP";
import { createCurveLpTokenExchangeEvent } from "./master-eigenpie-utils";

// import { Block, Transaction } from "@graphprotocol/graph-ts";
import {
  handleCurveLpTransfer,
  handleCurveTrading,
  handleCurveAddLiquidity,
  handleCurveRemoveLiquidity,
  handleCurveRemoveLiquidityOne,
  handleCurveRemoveLiquidityImbalance,
  handleMlrtTransfer,
  handleEigenpieStakingAssetDepositV1,
  handleEigenpieStakingAssetDepositV2,
  handlePriceProviderExchangeRateUpdateEvent,
} from "../src/masterEigenpie";

describe("MasterEigenpie", () => {
  test("Test Deposit", () => {});
  beforeAll(() => {
    let depositor = Address.fromString(
      "0x0000000000000000000000000000000000000001"
    );
    let address = Address.fromString(
      "0x2022d9AF896eCF0F1f5B48cdDaB9e74b5aAbCf00"
    );
    let depositAmount = BigInt.fromI32(234);
    let poinboost = BigInt.fromI32(234);
    let referral = Address.fromString(
      "0x0000000000000000000000000000000000000001"
    );
    let newCurveLpTokenExchangeEvent = createCurveLpTokenExchangeEvent(
      depositor,
      address,
      depositAmount,
      poinboost,
      referral
    );
    handleCurveTrading(newCurveLpTokenExchangeEvent);
  });

  afterAll(() => {
    clearStore();
  });

  test("AssetDeposit created and stored", () => {
    assert.entityCount("LpInfo", 1);

    let defaultAddress = "0xa16081f360e3847006db660bae1c6d1b2e17ec2a";
    // 0xa16081f360e3847006db660bae1c6d1b2e17ec2a is the default address used in newMockEvent() function
    // assert.fieldEquals(
    //   "LpInfo",
    //   defaultAddress,
    //   "depositor",
    //   "0x0000000000000000000000000000000000000001"
    // );
    // assert.fieldEquals(
    //   "LpInfo",
    //   defaultAddress,
    //   "asset",
    //   "0x0000000000000000000000000000000000000001"
    // );
    // assert.fieldEquals("LpInfo", defaultAddress, "depositAmount", "234");
    // assert.fieldEquals("LpInfo", defaultAddress, "poinboost", "234");
    // assert.fieldEquals(
    //   "LpInfo",
    //   defaultAddress,
    //   "referral",
    //   "0x0000000000000000000000000000000000000001"
    // );

    //   // More assert options:
    //   // https://thegraph.com/docs/en/developer/matchstick/#asserts
  });
});
