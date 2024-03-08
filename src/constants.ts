import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts"
export const EIGEN_LAYER_POINT_PER_SEC = BigInt.fromString("1000000000000000000").div(BigInt.fromI32(3600))
export const EIGENPIE_POINT_PER_SEC = BigInt.fromString("1000000000000000000").div(BigInt.fromI32(3600))
export const CURVE_POINT_PER_SEC = BigInt.fromString("2000000000000000000").div(BigInt.fromI32(3600))
export const RANGE_POINT_PER_SEC = BigInt.fromString("2000000000000000000").div(BigInt.fromI32(3600))
export const MLRT_POINT_PER_SEC = BigInt.fromString("1000000000000000000").div(BigInt.fromI32(3600))
export const ETHER_ONE = BigInt.fromString("1000000000000000000")
export const ETHER_TEN = BigInt.fromString("10000000000000000000")
export const DENOMINATOR = BigInt.fromI32(10000)
export const ADDRESS_ZERO = Address.fromHexString("0x0000000000000000000000000000000000000000")
export const ADDRESS_ZERO_BYTES = Bytes.fromHexString("0x0000000000000000000000000000000000000000")
export const BIGINT_ZERO = BigInt.fromI32(0)
export const BIGINT_ONE = BigInt.fromI32(1)
export const BIGINT_TWO = BigInt.fromI32(2)
export const BYTES_ZERO = Bytes.fromI32(0)
export const EIGEN_LAYER_LAUNCH_TIME = BigInt.fromI32(1707163200)
export const EIGENPIE_PREDEPLOST_HELPER = Address.fromHexString("0xcc5460cf8f81caa790b87910364e67ddb50e242b")
export const WSTETH = Address.fromHexString("0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0")
export const MSTETH_WSTETH_CURVE_LP = Address.fromHexString("0xC040041088B008EAC1bf5FB886eAc8c1e244B60F")
export const MSWETH_SWETH_CURVE_LP = Address.fromHexString("0x2022d9AF896eCF0F1f5B48cdDaB9e74b5aAbCf00")
export const MSTETH = Address.fromHexString("0x49446A0874197839D15395B908328a74ccc96Bc0")
export const STETH = Address.fromHexString("0xae7ab96520de3a18e5e111b5eaab095312d7fe84");
export const MRETH = Address.fromHexString("0xd05728038681bcc79b2d5aeb4d9b002e66C93A40")
export const RETH = Address.fromHexString("0xae78736cd615f374d3085123a210448e74fc6393");
export const MSFRXETH = Address.fromHexString("0x879054273cb2DAD631980Fa4efE6d25eeFe08AA4")
export const SFRXETH = Address.fromHexString("0xac3e018457b222d93114458476f3e3416abbe38f");
export const MMETH = Address.fromHexString("0x8a053350ca5F9352a16deD26ab333e2D251DAd7c")
export const METH = Address.fromHexString("0xd5f7838f5c461feff7fe49ea5ebaf7728bb0adfa");
export const MWBETH = Address.fromHexString("0xE46a5E19B19711332e33F33c2DB3eA143e86Bc10")
export const WBETH = Address.fromHexString("0xa2E3356610840701BDf5611a53974510Ae27E2e1");
export const MSWETH = Address.fromHexString("0x32bd822d615A3658A68b6fDD30c2fcb2C996D678")
export const SWETH = Address.fromHexString("0xf951e335afb289353dc249e82926178eac7ded78");
export const MCBETH = Address.fromHexString("0xD09124e8a1e3D620E8807aD1d968021A5495CEe8")
export const CBETH = Address.fromHexString("0xbe9895146f7af43049ca1c1ae358b0541ea49704");
export const METHX = Address.fromHexString("0x9a1722b1f4A1BB2F271211ade8e851aFc54F77E5")
export const ETHX = Address.fromHexString("0xa35b1b31ce002fbf2058d22f30f95d405200a15b");
export const MANKRETH = Address.fromHexString("0x5A4A503F4745c06A07E29D9a9DD88aB52f7a505B")
export const ANKRETH = Address.fromHexString("0xe95a203b1a91a908f9b9ce46459d101078c2c3cb");
export const MOSETH = Address.fromHexString("0x352a3144e88D23427993938cfd780291D95eF091")
export const OSETH = Address.fromHexString("0xf1c9acdc66974dfb6decb12aa385b9cd01190e38");
export const MOETH = Address.fromHexString("0x310718274509a38cc5559a1ff48c5eDbE75a382B")
export const OETH = Address.fromHexString("0x856c4efb76c1d1ae02e20ceb03a2a6a08b0b8dc3");
export const MLSETH = Address.fromHexString("0xa939C02DbA8F237b40d2A3E96AD4252b00Bb8a72")
export const LSETH = Address.fromHexString("0x8c1bed5b9a0928467c9b1341da1d7bd5e10b6549");
export const  LST_TO_MLRT_MAP = new Map<Address, Address>();
LST_TO_MLRT_MAP.set(STETH, MSTETH);
LST_TO_MLRT_MAP.set(RETH, MRETH);
LST_TO_MLRT_MAP.set(SFRXETH, MSFRXETH);
LST_TO_MLRT_MAP.set(METH, MMETH);
LST_TO_MLRT_MAP.set(WBETH, MWBETH);
LST_TO_MLRT_MAP.set(SWETH, MSWETH);
LST_TO_MLRT_MAP.set(CBETH, MCBETH);
LST_TO_MLRT_MAP.set(ETHX, METHX);
LST_TO_MLRT_MAP.set(ANKRETH, MANKRETH);
LST_TO_MLRT_MAP.set(OSETH, MOSETH);
LST_TO_MLRT_MAP.set(OETH, MOETH);
LST_TO_MLRT_MAP.set(LSETH, MLSETH);
export const LPTOKEN_LIST = [MSTETH, MRETH, MSFRXETH, MMETH, MWBETH, MSWETH, MCBETH, METHX, MANKRETH, MOSETH, MOETH, MLSETH, MSTETH_WSTETH_CURVE_LP, MSWETH_SWETH_CURVE_LP];
export const LST_PRICE_MAP = new Map<Address, BigInt>();
LST_PRICE_MAP.set(STETH, ETHER_ONE);
LST_PRICE_MAP.set(RETH, ETHER_ONE.times(BigInt.fromI32(1101)).div(BigInt.fromI32(1000)));
LST_PRICE_MAP.set(SFRXETH, ETHER_ONE.times(BigInt.fromI32(1077)).div(BigInt.fromI32(1000)));
LST_PRICE_MAP.set(METH, ETHER_ONE.times(BigInt.fromI32(1024)).div(BigInt.fromI32(1000)));
LST_PRICE_MAP.set(WBETH, ETHER_ONE.times(BigInt.fromI32(1033)).div(BigInt.fromI32(1000)));
LST_PRICE_MAP.set(SWETH, ETHER_ONE.times(BigInt.fromI32(1053)).div(BigInt.fromI32(1000)));
LST_PRICE_MAP.set(CBETH, ETHER_ONE.times(BigInt.fromI32(1065)).div(BigInt.fromI32(1000)));
LST_PRICE_MAP.set(ETHX, ETHER_ONE.times(BigInt.fromI32(1023)).div(BigInt.fromI32(1000)));
LST_PRICE_MAP.set(ANKRETH, ETHER_ONE.times(BigInt.fromI32(1149)).div(BigInt.fromI32(1000)));
LST_PRICE_MAP.set(OSETH, ETHER_ONE.times(BigInt.fromI32(1009)).div(BigInt.fromI32(1000)));
LST_PRICE_MAP.set(OETH, ETHER_ONE);
LST_PRICE_MAP.set(LSETH, ETHER_ONE.times(BigInt.fromI32(1042)).div(BigInt.fromI32(1000)));