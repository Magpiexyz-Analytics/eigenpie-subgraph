import { Address, Bytes } from "@graphprotocol/graph-ts";
import { newMockEvent } from "matchstick-as"
import {
    ExchangeRateUpdate
  } from "../generated/PriceProvider/PriceProvider"

export function createNewPriceProviderExchangeRateUpdateEvent(asset: Address, receipt: Address, newExchangeRate: BigInt) {
    let newPriceProviderExchangeRateUpdateEvent = changetype<ExchangeRateUpdate>(newMockEvent)
}