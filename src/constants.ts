import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts"
export const EIGEN_LAYER_POINT_PER_SEC = BigInt.fromString("1000000000000000000").div(BigInt.fromI32(3600))
export const EIGENPIE_POINT_PER_SEC = BigInt.fromString("1000000000000000000").div(BigInt.fromI32(3600))
export const CURVE_POINT_PER_SEC = BigInt.fromString("2000000000000000000").div(BigInt.fromI32(3600))
export const RANGE_POINT_PER_SEC = BigInt.fromString("2000000000000000000").div(BigInt.fromI32(3600))
export const MLRT_POINT_PER_SEC = BigInt.fromString("1000000000000000000").div(BigInt.fromI32(3600))
export const ETHER_ONE = BigInt.fromString("1000000000000000000")
export const DENOMINATOR = BigInt.fromI32(10000)
export const ADDRESS_ZERO = Address.fromString("0x0000000000000000000000000000000000000000")
export const BIGINT_ZERO = BigInt.fromI32(0)
export const BYTES_ZERO = Bytes.fromI32(0)
export const EIGEN_POINT_LAUNCH_TIME = BigInt.fromI32(1707163200)