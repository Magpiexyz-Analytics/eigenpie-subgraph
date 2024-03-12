import { newMockEvent } from "matchstick-as";
import { ethereum, Address, BigInt } from "@graphprotocol/graph-ts";
import { TokenExchange as CurveLpTokenExchangeEvent } from "../generated/CurveLP/CurveLP";
export function createCurveLpTokenExchangeEvent(
  depositor: Address,
  address: Address,
  depositAmount: BigInt,
  poinboost: BigInt,
  referral: Address
): CurveLpTokenExchangeEvent {
  let curveLpTokenExchangeEvent = changetype<CurveLpTokenExchangeEvent>(
    newMockEvent()
  );

  curveLpTokenExchangeEvent.parameters = new Array();

  curveLpTokenExchangeEvent.parameters.push(
    new ethereum.EventParam("depositor", ethereum.Value.fromAddress(depositor))
  );
  curveLpTokenExchangeEvent.parameters.push(
    new ethereum.EventParam("address", ethereum.Value.fromAddress(address))
  );
  curveLpTokenExchangeEvent.parameters.push(
    new ethereum.EventParam(
      "depositAmount",
      ethereum.Value.fromUnsignedBigInt(depositAmount)
    )
  );
  curveLpTokenExchangeEvent.parameters.push(
    new ethereum.EventParam(
      "poinboost",
      ethereum.Value.fromUnsignedBigInt(poinboost)
    )
  );
  curveLpTokenExchangeEvent.parameters.push(
    new ethereum.EventParam("referral", ethereum.Value.fromAddress(referral))
  );

  return curveLpTokenExchangeEvent;
}
