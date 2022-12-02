const { logTransaction } = require("@dlsl/hardhat-migrate");
const { KYC_REQUESTS_DEP } = require("./utils/constants");

const Registry = artifacts.require("MasterContractsRegistry");
const KYCRequests = artifacts.require("KYCRequests");

module.exports = async (deployer) => {
  const registry = await Registry.at(deployer.masterContractsRegistry);
  const kycRequests = await KYCRequests.at(await registry.getContract(KYC_REQUESTS_DEP));

  const kycRole = process.env.KYC_ROLE;

  if (kycRole == undefined || kycRole == "") {
    throw new Error(`Invalid KYC role`);
  }

  logTransaction(await kycRequests.__KYCRequests_init(kycRole), "Init KYCRequests");

  logTransaction(await registry.injectDependencies(KYC_REQUESTS_DEP), "Set dependencies at KYCRequests");
};
