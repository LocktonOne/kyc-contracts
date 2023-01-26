const {
  RBAC_CREATOR,
  REVIEWABLE_REQUESTS_CREATOR,
  REVIEWABLE_REQUESTS_REMOVER,
  RBAC_RESOURCE,
  REVIEWABLE_REQUESTS_RESOURCE,
  CREATE_PERMISSION,
  DELETE_PERMISSION,
  KYC_REQUESTS_DEP,
} = require("./utils/constants");

const Registry = artifacts.require("MasterContractsRegistry");
const MasterAccessManagement = artifacts.require("MasterAccessManagement");

module.exports = async (deployer, logger) => {
  const registry = await Registry.at(deployer.masterContractsRegistry);
  const masterAccess = await MasterAccessManagement.at(await registry.getMasterAccessManagement());

  const reviewableRequestsAddress = await registry.getReviewableRequests();
  const kycRequestsAddress = await registry.getContract(KYC_REQUESTS_DEP);

  const RBACCreate = [RBAC_RESOURCE, [CREATE_PERMISSION]];
  const ReviewableRequestsCreate = [REVIEWABLE_REQUESTS_RESOURCE, [CREATE_PERMISSION]];
  const ReviewableRequestsDelete = [REVIEWABLE_REQUESTS_RESOURCE, [DELETE_PERMISSION]];

  logger.logTransaction(
    await masterAccess.addPermissionsToRole(RBAC_CREATOR, [RBACCreate], true),
    `Added ${CREATE_PERMISSION} permission to ${RBAC_CREATOR} role`
  );

  logger.logTransaction(
    await masterAccess.addPermissionsToRole(REVIEWABLE_REQUESTS_CREATOR, [ReviewableRequestsCreate], true),
    `Added ${CREATE_PERMISSION} permission to ${REVIEWABLE_REQUESTS_CREATOR} role`
  );

  logger.logTransaction(
    await masterAccess.addPermissionsToRole(REVIEWABLE_REQUESTS_REMOVER, [ReviewableRequestsDelete], true),
    `Added ${DELETE_PERMISSION} permission to ${REVIEWABLE_REQUESTS_REMOVER} role`
  );

  logger.logTransaction(
    await masterAccess.grantRoles(reviewableRequestsAddress, [RBAC_CREATOR]),
    `Granted ${RBAC_CREATOR} role to ReviewableRequests contract`
  );

  logger.logTransaction(
    await masterAccess.grantRoles(kycRequestsAddress, [REVIEWABLE_REQUESTS_CREATOR, REVIEWABLE_REQUESTS_REMOVER]),
    `Granted ${REVIEWABLE_REQUESTS_CREATOR}, ${REVIEWABLE_REQUESTS_REMOVER} roles to KYCRequests contract`
  );
};
