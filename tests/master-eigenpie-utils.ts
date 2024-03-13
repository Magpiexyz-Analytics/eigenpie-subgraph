import { newMockEvent } from "matchstick-as";
import { ethereum, Address, BigInt } from "@graphprotocol/graph-ts";
import { TokenExchange as CurveLpTokenExchangeEvent } from "../generated/CurveLP/CurveLP";
export function createCurveLpTokenExchangeEvent(
  id: i32,
  buyer: string,
  sold_id: BigInt,
  tokens_sold: BigInt,
  bought_id: BigInt,
  tokens_bought: BigInt
): CurveLpTokenExchangeEvent {
  let curveLpTokenExchangeEvent = changetype<CurveLpTokenExchangeEvent>(
    newMockEvent()
  );

  curveLpTokenExchangeEvent.parameters = new Array();
  let idParam = new ethereum.EventParam("id", ethereum.Value.fromI32(id));
  let buyerParam = new ethereum.EventParam(
    "buyer",
    ethereum.Value.fromAddress(Address.fromString(buyer))
  );
  let soldIdParam = new ethereum.EventParam(
    "sold_id",
    ethereum.Value.fromUnsignedBigInt(sold_id)
  );
  let tokenSoldParam = new ethereum.EventParam(
    "tokens_sold",
    ethereum.Value.fromUnsignedBigInt(tokens_sold)
  );
  let boughtIdParam = new ethereum.EventParam(
    "bought_id",
    ethereum.Value.fromUnsignedBigInt(bought_id)
  );
  let tokensBoughtParam = new ethereum.EventParam(
    "tokens_bought",
    ethereum.Value.fromUnsignedBigInt(tokens_bought)
  );
  // check whether the timestamp event is made or not?

  curveLpTokenExchangeEvent.parameters.push(idParam);
  curveLpTokenExchangeEvent.parameters.push(buyerParam);
  curveLpTokenExchangeEvent.parameters.push(soldIdParam);
  curveLpTokenExchangeEvent.parameters.push(tokenSoldParam);
  curveLpTokenExchangeEvent.parameters.push(boughtIdParam);
  curveLpTokenExchangeEvent.parameters.push(tokensBoughtParam);

  return curveLpTokenExchangeEvent;
}
