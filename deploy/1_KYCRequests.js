const { getConfigJson } = require("./config/config-getter");
const { KYC_REQUESTS_DEP } = require("./utils/constants");

const Registry = artifacts.require("MasterContractsRegistry");
const KYCRequests = artifacts.require("KYCRequests");

module.exports = async (deployer, logger) => {
  const config = await getConfigJson();

  if (config.addresses == undefined || config.addresses.MasterContractsRegistry == undefined) {
    throw new Error(`Invalid config fetched`);
  }

  deployer.masterContractsRegistry = config.addresses.MasterContractsRegistry;

  const registry = await Registry.at(deployer.masterContractsRegistry);

  const kycRequests = await deployer.deploy(KYCRequests);

  logger.logTransaction(await registry.addProxyContract(KYC_REQUESTS_DEP, kycRequests.address), "Deploy KYCRequests");
};
