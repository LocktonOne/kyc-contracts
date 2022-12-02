const { accounts, toBN } = require("../../scripts/utils/utils");
const {
  CREATE_PERMISSION,
  DELETE_PERMISSION,
  UPDATE_PERMISSION,
  RBAC_RESOURCE,
  REVIEWABLE_REQUESTS_RESOURCE,
  KYC_REQUESTS_RESOURCE,
  KYC_REQUESTS_DEP,
  RequestStatus,
} = require("../utils/constants");

const Reverter = require("../helpers/reverter");
const truffleAssert = require("truffle-assertions");
const { assert } = require("chai");

const MasterContractsRegistry = artifacts.require("MasterContractsRegistry");
const MasterAccessManagement = artifacts.require("MasterAccessManagement");
const ReviewableRequests = artifacts.require("ReviewableRequests");
const KYCRequests = artifacts.require("KYCRequests");

describe("KYCRequests", async () => {
  const reverter = new Reverter();

  let OWNER;
  let USER1;
  let USER2;

  const ReviewableRequestsRole = "RR";
  const ReviewableRequestsRBACRole = "RRRBACR";
  const KYCRequestsUpdateRole = "KYCU";

  const KYCRole = "KYCR";

  const ReviewableRequestsCreate = [REVIEWABLE_REQUESTS_RESOURCE, [CREATE_PERMISSION, DELETE_PERMISSION]];
  const ReviewableRequestsRBACCreate = [RBAC_RESOURCE, [CREATE_PERMISSION]];
  const KYCRequestsUpdate = [KYC_REQUESTS_RESOURCE, [UPDATE_PERMISSION]];

  let registry;
  let masterAccess;
  let reviewableRequests;
  let kycRequests;

  before("setup", async () => {
    OWNER = await accounts(0);
    USER1 = await accounts(1);
    USER2 = await accounts(2);

    registry = await MasterContractsRegistry.new();

    const _masterAccess = await MasterAccessManagement.new();
    const _reviewableRequests = await ReviewableRequests.new();
    const _kycRequests = await KYCRequests.new();

    await registry.__MasterContractsRegistry_init(_masterAccess.address);

    masterAccess = await MasterAccessManagement.at(await registry.getMasterAccessManagement());
    await masterAccess.__MasterAccessManagement_init(OWNER);

    await registry.addProxyContract(await registry.REVIEWABLE_REQUESTS_NAME(), _reviewableRequests.address);
    await registry.addProxyContract(KYC_REQUESTS_DEP, _kycRequests.address);

    reviewableRequests = await ReviewableRequests.at(await registry.getReviewableRequests());
    kycRequests = await KYCRequests.at(await registry.getContract(KYC_REQUESTS_DEP));

    await kycRequests.__KYCRequests_init(KYCRole);

    await registry.injectDependencies(await registry.REVIEWABLE_REQUESTS_NAME());
    await registry.injectDependencies(KYC_REQUESTS_DEP);

    await masterAccess.addPermissionsToRole(ReviewableRequestsRBACRole, [ReviewableRequestsRBACCreate], true);
    await masterAccess.grantRoles(reviewableRequests.address, [ReviewableRequestsRBACRole]);

    await masterAccess.addPermissionsToRole(ReviewableRequestsRole, [ReviewableRequestsCreate], true);
    await masterAccess.grantRoles(kycRequests.address, [ReviewableRequestsRole]);

    await masterAccess.addPermissionsToRole(KYCRequestsUpdateRole, [KYCRequestsUpdate], true);
    await masterAccess.grantRoles(USER1, [KYCRequestsUpdateRole]);

    await reverter.snapshot();
  });

  afterEach("revert", reverter.revert);

  describe("creation", () => {
    it("should get exception if try to call init function twice", async () => {
      const reason = "Initializable: contract is already initialized";

      await truffleAssert.reverts(kycRequests.__KYCRequests_init(KYCRole), reason);
    });

    it("should get exception if pass empty KYC role string", async () => {
      const _kycRequests = await KYCRequests.new();
      const reason = "KYCRequests: empty KYC role";

      await truffleAssert.reverts(_kycRequests.__KYCRequests_init(""), reason);
    });

    it("should get exception if not an injector try to call set dependencies function", async () => {
      const reason = "Dependant: Not an injector";

      await truffleAssert.reverts(kycRequests.setDependencies(registry.address, { from: USER1 }), reason);
    });
  });

  describe("updateKYCRole", () => {
    const newKYCRole = "new KYC role";

    it("should correctly update KYC role", async () => {
      const tx = await kycRequests.updateKYCRole(newKYCRole, { from: USER1 });

      assert.equal(await kycRequests.KYCRole(), newKYCRole);

      assert.equal(tx.receipt.logs[0].event, "KYCRoleUpdated");
      assert.equal(tx.receipt.logs[0].args.newKYCRole, newKYCRole);
    });

    it("should get exception if user without permission try to call this function", async () => {
      const reason = "KYCRequests: access denied";

      await truffleAssert.reverts(kycRequests.updateKYCRole(newKYCRole, { from: USER2 }), reason);
    });
  });

  describe("requestKYCRole", () => {
    const kycHash = "some hash";

    it("should correctly request KYC role", async () => {
      let userRequestInfo = await kycRequests.usersRequestInfo(USER1);
      assert.equal(userRequestInfo.requestId.toString(), 0);
      assert.equal(userRequestInfo.existingRequest, false);

      const tx = await kycRequests.requestKYCRole(kycHash, { from: USER1 });

      userRequestInfo = await kycRequests.usersRequestInfo(USER1);
      assert.equal(userRequestInfo.requestId.toString(), 0);
      assert.equal(userRequestInfo.existingRequest, true);

      assert.equal(tx.receipt.logs[0].event, "KYCRoleRequested");
      assert.equal(tx.receipt.logs[0].args.userAddr, USER1);
      assert.equal(toBN(tx.receipt.logs[0].args.requestId).toString(), 0);
    });

    it("should correctly accept request and grant role", async () => {
      await kycRequests.requestKYCRole(kycHash, { from: USER1 });

      await reviewableRequests.acceptRequest(0);

      assert.equal((await reviewableRequests.requests(0)).status, RequestStatus.ACCEPTED);
      assert.deepEqual(await masterAccess.getUserRoles(USER1), [KYCRequestsUpdateRole, KYCRole]);
    });

    it("should correctly create request after accepted, rejected or dropped request", async () => {
      await kycRequests.requestKYCRole(kycHash, { from: USER1 });

      assert.equal((await reviewableRequests.requests(0)).status, RequestStatus.PENDING);

      await reviewableRequests.rejectRequest(0);

      assert.equal((await reviewableRequests.requests(0)).status, RequestStatus.REJECTED);

      await kycRequests.requestKYCRole(kycHash, { from: USER1 });

      assert.equal((await reviewableRequests.requests(1)).status, RequestStatus.PENDING);

      await kycRequests.dropKYCRequest({ from: USER1 });

      assert.equal((await reviewableRequests.requests(1)).status, RequestStatus.DROPPED);

      await kycRequests.requestKYCRole(kycHash, { from: USER1 });

      assert.equal((await reviewableRequests.requests(2)).status, RequestStatus.PENDING);

      await reviewableRequests.acceptRequest(2);

      assert.equal((await reviewableRequests.requests(2)).status, RequestStatus.ACCEPTED);

      await kycRequests.requestKYCRole(kycHash, { from: USER1 });
    });

    it("should get exception if user has a pending request", async () => {
      const reason = "KYCRequests: user has a pending requests";

      await kycRequests.requestKYCRole(kycHash, { from: USER1 });

      await truffleAssert.reverts(kycRequests.requestKYCRole(kycHash, { from: USER1 }), reason);
    });
  });

  describe("dropKYCRequest", () => {
    const kycHash = "some hash";

    it("should correctly drop the KYC request", async () => {
      await kycRequests.requestKYCRole(kycHash, { from: USER1 });

      const tx = await kycRequests.dropKYCRequest({ from: USER1 });

      assert.equal((await reviewableRequests.requests(0)).status, RequestStatus.DROPPED);

      assert.equal(tx.receipt.logs[0].event, "KYCRequestDropped");
      assert.equal(tx.receipt.logs[0].args.userAddr, USER1);
      assert.equal(toBN(tx.receipt.logs[0].args.requestId).toString(), 0);
    });

    it("should get exception if user has no request", async () => {
      const reason = "KYCRequests: user has no request";

      await truffleAssert.reverts(kycRequests.dropKYCRequest({ from: USER1 }), reason);
    });

    it("should get exception if user has no pending request", async () => {
      await kycRequests.requestKYCRole(kycHash, { from: USER1 });
      await reviewableRequests.acceptRequest(0);

      const reason = "KYCRequests: user has no pending requests";

      await truffleAssert.reverts(kycRequests.dropKYCRequest({ from: USER1 }), reason);
    });
  });
});
