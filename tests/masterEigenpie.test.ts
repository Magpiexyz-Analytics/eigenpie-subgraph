import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts";
import { beforeAll, describe, newMockEvent, test } from "matchstick-as";
import {
  assert,
  createMockedFunction,
  clearStore,
  newMockCall,
  countEntities,
  mockIpfsFile,
  afterEach,
  afterAll,
} from "matchstick-as/assembly/index";
import {
  createCurveLpTokenExchangeEvent,
  createCurveLpTransferEvent,
} from "./master-eigenpie-utils";
import {
  GlobalInfo,
  GroupInfo,
  LpInfo,
  PoolInfo,
  UserBalanceInfo,
  UserInfo,
} from "../generated/schema";
import { ADDRESS_ZERO, EIGEN_LAYER_POINT_PER_SEC, ETHER_ONE } from "../src/constants";
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

test(
  "Should throw an error",
  () => {
    throw new Error();
  },
  true
);

describe("Entity Store For LpInfo", () => {
  beforeAll(() => {
    let lpInfo = new LpInfo(Bytes.fromHexString("lpInfoId0"));
    lpInfo.lpToken = Bytes.fromHexString("lpInfoId0");
    lpInfo.priceToETH = ETHER_ONE;
    lpInfo.mLrtRatio = ETHER_ONE;
    lpInfo.eigenLayerPointsPerSec = EIGEN_LAYER_POINT_PER_SEC;
    lpInfo.eigenpiePointsPerSec = BigInt.fromString("1000000000000000000").div(
      BigInt.fromI32(3600)
    );
    lpInfo.save();
  });

  afterAll(() => {
    clearStore();
  });

  test("Can use entity.loadInBlock() to retrieve entity from cache store in the current block", () => {
    let retrievedLpInfo = LpInfo.loadInBlock(Bytes.fromHexString("LpInfo0"));
    assert.bytesEquals(
      Bytes.fromHexString("LpInfo0"),
      retrievedLpInfo!.get("id")!.toBytes()
    );
  });

  test("Returns null when calling entity.loadInBlock() if an entity doesn't exist in the current block", () => {
    let retrievedLpInfo = LpInfo.loadInBlock(
      Bytes.fromHexString("IDoNotExist")
    );
    assert.assertNull(retrievedLpInfo);
  });

  test("Can use entity.load() to retrieve entity from store", () => {
    let retrievedLpInfo = LpInfo.load(Bytes.fromHexString("LpInfo0"));
    assert.bytesEquals(
      Bytes.fromHexString("LpInfo0"),
      retrievedLpInfo!.get("id")!.toBytes()
    );
  });

  test("Returns null when calling entity.load() if an entity doesn't exist", () => {
    let retrievedLpInfo = LpInfo.load(Bytes.fromHexString("IDoNotExist"));
    assert.assertNull(retrievedLpInfo);
  });

  test("Can update entity that already exists using Entity.save()", () => {
    // Retrieve same entity from the store
    let lpinfo = LpInfo.load(Bytes.fromHexString("LpInfo0"));
    if (lpinfo != null) {
      lpinfo.set("priceToETH", ETHER_ONE.plus(ETHER_ONE)); // check why error throwing
      lpinfo.save();

      assert.fieldEquals(
        "LpInfo",
        "LpInfo0",
        "priceToETH",
        "2000000000000000000"
      );
    }
  });

  test("Can assert amount of entities of a certain type in store", () => {
    clearStore();
    assert.entityCount("LpInfo", 0);

    let counter = 1;
    while (countEntities("LpInfo") < 2) {
      let newLpInfo = new LpInfo(
        Bytes.fromHexString("id" + counter.toString())
      );
      newLpInfo.priceToETH = ETHER_ONE;
      newLpInfo.mLrtRatio = ETHER_ONE;
      newLpInfo.eigenLayerPointsPerSec = EIGEN_LAYER_POINT_PER_SEC;
      newLpInfo.eigenpiePointsPerSec = BigInt.fromString(
        "1000000000000000000"
      ).div(BigInt.fromI32(3600));
      newLpInfo.save();
      counter++;
    }

    assert.entityCount("LpInfo", 2);
  });
});

describe("Mocked Events", () => {
  afterEach(() => {
    clearStore();
  });

  test("Can call mappings with custom events For Handle Curve Trading", () => {
    // Call mappings
    let address = "SOME_RANDOM_ADDRESS"; // TODO replace with actual address
    let newCurveLpTokenExchangeEvent = createCurveLpTokenExchangeEvent(
      0xdead,
      address,
      "0x53e12dfA22a903dCC0c54aBAf0E5017eEfC9DaF6",
      BigInt.fromI32(0),
      BigInt.fromString("63993754201653557777"),
      BigInt.fromI32(1),
      BigInt.fromString("54493385790308612876")
    );

    handleCurveTrading(newCurveLpTokenExchangeEvent);

    assert.entityCount("LpInfo", 1);
    assert.fieldEquals("LpInfo", "0xdead", "sold_id", "0");
    assert.fieldEquals("LpInfo", "0xdead", "bought_id", "1");
    assert.fieldEquals(
      "LpInfo",
      "0xdead",
      "tokens_sold",
      "63993754201653557777"
    );
    assert.fieldEquals(
      "LpInfo",
      "0xdead",
      "tokens_bought",
      "54493385790308612876"
    );
  });

  test("Can call mappings with custom events", () => {
    // Call mappings
    let sender = "0x53e12dfA22a903dCC0c54aBAf0E5017eEfC9DaF6",
      receiver = "0x53e12dfA22a903dCC0c54aBAf0E5017eEfC9DaF7",
      lpAddress = "0x53e12dfA22a903dCC0c54aBAf0E5017eEfC9DaF8";

    let newCurveLpTransferEvent = createCurveLpTransferEvent(
      0xdead,
      lpAddress,
      sender,
      receiver,
      BigInt.fromString("123")
    );

    handleCurveLpTransfer(newCurveLpTransferEvent);

    assert.entityCount("UserInfo", 2);
    assert.fieldEquals("UserInfo", sender, "user", sender);
    assert.fieldEquals("UserInfo", sender, "group", sender);
    assert.fieldEquals("UserInfo", receiver, "user", receiver);
    assert.fieldEquals("UserInfo", receiver, "group", receiver);
    assert.fieldEquals("PoolInfo", sender.concat(lpAddress), "group", sender);
    assert.fieldEquals(
      "PoolInfo",
      receiver.concat(lpAddress),
      "group",
      receiver
    );
    assert.fieldEquals(
      "PoolInfo",
      sender.concat(lpAddress),
      "lpToken",
      lpAddress
    );
    assert.fieldEquals(
      "PoolInfo",
      receiver.concat(lpAddress),
      "lpToken",
      lpAddress
    );
    // assert.fieldEquals("UserBalanceInfo",sender.concat()) // TODO : Add the assertions for the UserBalanceInfo
    assert.fieldEquals("GlobalInfo",ADDRESS_ZERO,"globalBoost",ETHER_ONE);
  });
});
