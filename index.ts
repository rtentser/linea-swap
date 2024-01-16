import {
  AbiCoder,
  Contract,
  ContractRunner,
  Provider,
  Wallet,
  ZeroAddress,
  formatUnits,
  getDefaultProvider,
  parseEther,
} from "ethers";
import * as fs from "fs/promises";
import { sleep } from "ts-delay";

import * as networks from "./config/networks.json";
import * as swapConfig from "./config/swap.json";

interface Network {
  name: string;
  router: string;
  factory: string;
  usdt: string;
}

const network: Network = networks[swapConfig.network as keyof object];

const provider = getDefaultProvider(network.name);

const routerPath = "./abis/SyncSwapRouter.json";

const getWallets = async (provider: Provider) => {
  const walletsFile = await fs.open("./config/wallets.txt");
  const wallets = new Array();

  for await (const wallet of walletsFile.readLines()) {
    wallets.push(new Wallet(wallet, provider));
  }

  return wallets;
};

const randomizeArray = (a: any[]) => {
  let ra = new Array();

  while (a.length) {
    const index = Math.floor(Math.random() * a.length);
    ra.push(a[index]);
    a.splice(index, 1);
  }

  return ra;
};

const getAbi = async (path: string) => {
  const file = await fs.open(path);
  const content = await file.readFile({ encoding: "utf-8" });
  await file.close();
  return content;
};

const getContract = async (
  address: string,
  pathToAbi: string,
  provider: ContractRunner
) => {
  return new Contract(address, await getAbi(pathToAbi), provider);
};

const swap = async (
  router: Contract,
  runner: Wallet,
  amountIn: BigInt,
  amountOut: number,
  weth: string,
  pool: string
) => {
  const withdrawMode = 1;

  const swapData: string = AbiCoder.defaultAbiCoder().encode(
    ["address", "address", "uint8"],
    [weth, runner.address, withdrawMode]
  );

  const steps = [
    {
      pool: pool,
      data: swapData,
      callback: ZeroAddress,
      callbackData: "0x",
    },
  ];

  const paths = [
    {
      steps: steps,
      tokenIn: weth,
      amountIn: amountIn,
    },
  ];

  try {
    const gasPrice = (await provider.getFeeData()).gasPrice;
    const response = await (router.connect(runner) as Contract).swap(
      paths,
      BigInt(amountOut * 10 ** 6),
      BigInt(Math.floor(Date.now() / 1000)) + BigInt(3600),
      {
        gasPrice: gasPrice,
        value: amountIn,
      }
    );

    console.log("Transaction:", response.hash);
    console.log("Waiting for receipt...");

    await response.wait();

    console.log("Receipt received\n");

    console.log("Wallet:", runner.address);
    console.log("Pool:", "ETH/USDC");
    console.log("Swap amount:", amountOut, "USD");
    console.log("ETH spent:", formatUnits(amountIn.toString()), "ETH");
  } catch (e) {
    console.error("Wallet:", runner.address);
    console.error("Pool:", "ETH/USDT");
    console.error("SwapAmount:", amountOut, "USD");
    console.log("ETH spent:", formatUnits(amountIn.toString()), "ETH");
    console.error(e);
  }
};

const randomizeNumber = (min: number, max: number) => {
  return Math.random() * (max - min) + min;
};

const main = async () => {
  let wallets = await getWallets(provider);
  if (swapConfig.randomize) wallets = randomizeArray(wallets);

  const router = await getContract(network.router, routerPath, provider);
  const factory = await getContract(
    network.factory,
    "./abis/SyncSwapClassicPoolFactory.json",
    provider
  );

  const weth = await router.wETH();
  const poolAddress = await factory.getPool(weth, network.usdt);
  const pool = await getContract(
    poolAddress,
    "./abis/SyncSwapClassicPool.json",
    provider
  );

  for (let i = 0; i < wallets.length; i++) {
    const amountOut =
      Math.floor(
        randomizeNumber(
          swapConfig.amount0utMin,
          swapConfig.amountOutMax + 0.01
        ) * 100
      ) / 100;

    const amountIn = await pool.getAmountIn(
      network.usdt,
      BigInt(amountOut * 10 ** 6),
      wallets[i].address
    );

    await swap(
      router,
      wallets[i],
      amountIn,
      amountOut,
      ZeroAddress, // Using zero address for native swaps
      poolAddress
    );

    const delay = Math.floor(
      randomizeNumber(swapConfig.delayMin, swapConfig.delayMax + 1)
    );
    console.log("Sleeping for", delay / 1000, "seconds");
    await sleep(delay);
  }
};

main().catch((e) => console.error(e));
