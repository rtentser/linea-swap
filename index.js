"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
const ethers_1 = require("ethers");
const fs = __importStar(require("fs/promises"));
const ts_delay_1 = require("ts-delay");
const networks = __importStar(require("./config/networks.json"));
const swapConfig = __importStar(require("./config/swap.json"));
const network = networks[swapConfig.network];
const provider = (0, ethers_1.getDefaultProvider)(network.name);
const routerPath = "./abis/SyncSwapRouter.json";
const getWallets = (provider) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, e_1, _b, _c;
    const walletsFile = yield fs.open("./config/wallets.txt");
    const wallets = new Array();
    try {
        for (var _d = true, _e = __asyncValues(walletsFile.readLines()), _f; _f = yield _e.next(), _a = _f.done, !_a; _d = true) {
            _c = _f.value;
            _d = false;
            const wallet = _c;
            wallets.push(new ethers_1.Wallet(wallet, provider));
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (!_d && !_a && (_b = _e.return)) yield _b.call(_e);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return wallets;
});
const randomizeArray = (a) => {
    let ra = new Array();
    while (a.length) {
        const index = Math.floor(Math.random() * a.length);
        ra.push(a[index]);
        a.splice(index, 1);
    }
    return ra;
};
const getAbi = (path) => __awaiter(void 0, void 0, void 0, function* () {
    const file = yield fs.open(path);
    const content = yield file.readFile({ encoding: "utf-8" });
    yield file.close();
    return content;
});
const getContract = (address, pathToAbi, provider) => __awaiter(void 0, void 0, void 0, function* () {
    return new ethers_1.Contract(address, yield getAbi(pathToAbi), provider);
});
const swap = (router, runner, amountIn, amountOut, weth, pool) => __awaiter(void 0, void 0, void 0, function* () {
    const withdrawMode = 1;
    const swapData = ethers_1.AbiCoder.defaultAbiCoder().encode(["address", "address", "uint8"], [weth, runner.address, withdrawMode]);
    const steps = [
        {
            pool: pool,
            data: swapData,
            callback: ethers_1.ZeroAddress,
            callbackData: "0x",
        },
    ];
    const paths = [
        {
            steps: steps,
            tokenIn: ethers_1.ZeroAddress,
            amountIn: amountIn,
        },
    ];
    try {
        const gasPrice = (yield provider.getFeeData()).gasPrice;
        const response = yield router.connect(runner).swap(paths, BigInt(amountOut * 10 ** 6), BigInt(Math.floor(Date.now() / 1000)) + BigInt(3600), {
            gasPrice: gasPrice,
            value: amountIn,
        });
        console.log("Transaction:", response.hash);
        console.log("Waiting for receipt...");
        yield response.wait();
        console.log("Receipt received\n");
        console.log("Wallet:", runner.address);
        console.log("Pool:", "ETH/USDT");
        console.log("Swap amount:", amountOut, "USD");
        console.log("ETH spent:", (0, ethers_1.formatUnits)(amountIn.toString()), "ETH");
    }
    catch (e) {
        console.error("Wallet:", runner.address);
        console.error("Pool:", "ETH/USDT");
        console.error("SwapAmount:", amountOut, "USD");
        console.log("ETH spent:", (0, ethers_1.formatUnits)(amountIn.toString()), "ETH");
        console.error(e);
    }
});
const randomizeNumber = (min, max) => {
    return Math.random() * (max - min) + min;
};
const main = () => __awaiter(void 0, void 0, void 0, function* () {
    let wallets = yield getWallets(provider);
    if (swapConfig.randomize)
        wallets = randomizeArray(wallets);
    const router = yield getContract(network.router, routerPath, provider);
    const factory = yield getContract(network.factory, "./abis/SyncSwapClassicPoolFactory.json", provider);
    const weth = yield router.wETH();
    const poolAddress = yield factory.getPool(weth, network.usdt);
    const pool = yield getContract(poolAddress, "./abis/SyncSwapClassicPool.json", provider);
    for (let i = 0; i < wallets.length; i++) {
        const amountOut = Math.floor(randomizeNumber(swapConfig.amount0utMin, swapConfig.amountOutMax + 0.01) * 100) / 100;
        const amountIn = yield pool.getAmountIn(network.usdt, BigInt(amountOut * 10 ** 6), wallets[i].address);
        yield swap(router, wallets[i], amountIn, amountOut, weth, // Using zero address for native swaps
        poolAddress);
        const delay = Math.floor(randomizeNumber(swapConfig.delayMin, swapConfig.delayMax + 1));
        console.log("Sleeping for", delay / 1000, "seconds");
        yield (0, ts_delay_1.sleep)(delay);
    }
});
main().catch((e) => console.error(e));
