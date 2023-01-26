const { getConfigJson } = require("./config/config-parser");
const { KYC_REQUESTS_DEP } = require("./utils/constants");

const Registry = artifacts.require("MasterContractsRegistry");
const KYCRequests = artifacts.require("KYCRequests");

module.exports = async (deployer, logger) => {
  const registry = await Registry.at(deployer.masterContractsRegistry);
  const kycRequests = await KYCRequests.at(await registry.getContract(KYC_REQUESTS_DEP));

  const kycRole = getConfigJson().role;

  if (kycRole == undefined || kycRole == "") {
    throw new Error(`Invalid KYC role`);
  }

  logger.logTransaction(await kycRequests.__KYCRequests_init(kycRole), "Init KYCRequests");

  logger.logTransaction(await registry.injectDependencies(KYC_REQUESTS_DEP), "Set dependencies at KYCRequests");
};
