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
  usdc: string;
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
  amountOutMin: BigInt,
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
    const response = await (router.connect(runner) as Contract).swap(
      paths,
      amountOutMin,
      BigInt(Math.floor(Date.now() / 1000)) + BigInt(3600),
      {
        value: amountIn,
      }
    );
    const tx = await response.wait();

    console.log("Wallet:", runner.address);
    console.log("Pool:", "ETH/USDC");
    console.log("AmountIn:", formatUnits(amountIn.toString()));
    console.log("AmountOut:", formatUnits(amountOutMin.toString(), 6), "USDC");
    console.log("Transaction:", tx.hash);
  } catch (e) {
    console.error("Wallet:", runner.address);
    console.error("Pool:", "ETH/USDC");
    console.error("AmountIn:", formatUnits(amountIn.toString()), "ETH");
    console.error(
      "AmountOut:",
      formatUnits(amountOutMin.toString(), 6),
      "USDC"
    );
    console.error(e);
  }
};

const randomizeNumber = (min: number, max: number) => {
  return Math.random() * (max - min) + min;
};

const randomizeEther = (min: number, max: number) => {
  // Floor to 18 decimals
  return Math.floor(10 ** 18 * (Math.random() * (max - min) + min)) / 10 ** 18;
};

const main = async () => {
  const wallets = await getWallets(provider);
  const router = await getContract(network.router, routerPath, provider);
  const factory = await getContract(
    network.factory,
    "./abis/SyncSwapClassicPoolFactory.json",
    provider
  );

  const weth = await router.wETH();
  const poolAddress = await factory.getPool(weth, network.usdc);
  const pool = await getContract(
    poolAddress,
    "./abis/SyncSwapClassicPool.json",
    provider
  );

  (swapConfig.randomize ? randomizeArray(wallets) : wallets).forEach(
    async (wallet) => {
      const amountIn = parseEther(
        randomizeEther(swapConfig.amountInMin, swapConfig.amountInMax).toFixed(
          18
        )
      );

      const amountOut = await pool.getAmountOut(weth, amountIn, wallet.address);

      await swap(router, wallet, amountIn, amountOut, weth, poolAddress);
      await sleep(
        Math.floor(randomizeNumber(swapConfig.delayMin, swapConfig.delayMax))
      );
    }
  );
};

main().catch((e) => console.error(e));
