const { logTransaction } = require("@dlsl/hardhat-migrate");
const {
  REVIEWABLE_REQUESTS_CREATOR,
  REVIEWABLE_REQUESTS_REMOVER,
  REVIEWABLE_REQUESTS_RESOURCE,
  CREATE_PERMISSION,
  DELETE_PERMISSION,
  KYC_REQUESTS_DEP,
} = require("./utils/constants");

const Registry = artifacts.require("MasterContractsRegistry");
const MasterAccessManagement = artifacts.require("MasterAccessManagement");

module.exports = async (deployer) => {
  const registry = await Registry.at(deployer.masterContractsRegistry);
  const masterAccess = await MasterAccessManagement.at(await registry.getMasterAccessManagement());

  const kycRequestsAddress = await registry.getContract(KYC_REQUESTS_DEP);

  const ReviewableRequestsCreate = [REVIEWABLE_REQUESTS_RESOURCE, [CREATE_PERMISSION]];
  const ReviewableRequestsDelete = [REVIEWABLE_REQUESTS_RESOURCE, [DELETE_PERMISSION]];

  logTransaction(
    await masterAccess.addPermissionsToRole(REVIEWABLE_REQUESTS_CREATOR, [ReviewableRequestsCreate], true),
    `Added ${CREATE_PERMISSION} permission to ${REVIEWABLE_REQUESTS_CREATOR} role`
  );

  logTransaction(
    await masterAccess.addPermissionsToRole(REVIEWABLE_REQUESTS_REMOVER, [ReviewableRequestsDelete], true),
    `Added ${DELETE_PERMISSION} permission to ${REVIEWABLE_REQUESTS_REMOVER} role`
  );

  logTransaction(
    await masterAccess.grantRoles(kycRequestsAddress, [REVIEWABLE_REQUESTS_CREATOR]),
    `Granted ${REVIEWABLE_REQUESTS_CREATOR} role to KYCRequests contract`
  );
};
