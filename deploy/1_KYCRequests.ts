import { Deployer } from "@solarity/hardhat-migrate";

import { KYCRequests__factory, MasterContractsRegistry__factory } from "@/generated-types/ethers";

import { getConfigJsonFromVault } from "./config/config-getter";

import { KYC_REQUESTS_DEP } from "./utils/constants";

export = async (deployer: Deployer) => {
  const config = await getConfigJsonFromVault();

  const registry = await deployer.deployed(MasterContractsRegistry__factory, config.addresses.MasterContractsRegistry);

  const kycRequests = await deployer.deploy(KYCRequests__factory);

  await registry.addProxyContract(KYC_REQUESTS_DEP, await kycRequests.getAddress());
};
