import {
  AbiCoder,
  Contract,
  ContractRunner,
  Provider,
  Wallet,
  ZeroAddress,
  getDefaultProvider,
  parseEther,
} from "ethers";
import * as fs from "fs/promises";
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

  const response = await (router.connect(runner) as Contract).swap(
    paths,
    amountOutMin,
    BigInt(Math.floor(Date.now() / 1000)) + BigInt(1800),
    {
      value: amountIn,
    }
  );

  let tx = await response.wait();
  console.log(tx);
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

  wallets.forEach(async (wallet) => {
    const price = await pool.getAmountOut(
      weth,
      parseEther("0.0000001"),
      wallets[0].address
    );

    await swap(
      router,
      wallet,
      parseEther("0.0000001"),
      price,
      weth,
      poolAddress
    );
  });
};

main();
