// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/utils/Strings.sol";

import "@dlsl/dev-modules/contracts-registry/AbstractDependant.sol";
import "@dlsl/dev-modules/libs/arrays/ArrayHelper.sol";

import "@tokene/core-contracts/core/MasterContractsRegistry.sol";
import "@tokene/core-contracts/core/MasterAccessManagement.sol";
import "@tokene/core-contracts/core/ReviewableRequests.sol";

import "../interfaces/kyc-requests/IKYCRequests.sol";

contract KYCRequests is IKYCRequests, AbstractDependant, Initializable {
    using Strings for uint256;

    string public constant UPDATE_PERMISSION = "UPDATE";

    string public constant KYC_REQUESTS_RESOURCE = "KYC_REQUESTS_RESOURCE";

    string public constant KYC_REQUESTS_DEP = "KYC_REQUESTS";

    string public override KYCRole;

    MasterAccessManagement internal _masterAccess;
    ReviewableRequests internal _reviewableRequests;

    mapping(address => UserRequestInfo) public override usersRequestInfo;

    modifier onlyUpdatePermission() {
        require(
            _masterAccess.hasPermission(msg.sender, KYC_REQUESTS_RESOURCE, UPDATE_PERMISSION),
            "KYCRequests: access denied"
        );
        _;
    }

    function __KYCRequests_init(string calldata KYCRole_) external initializer {
        _updateKYCRole(KYCRole_);
    }

    function setDependencies(address registryAddress_) public override dependant {
        MasterContractsRegistry registry_ = MasterContractsRegistry(registryAddress_);

        _masterAccess = MasterAccessManagement(registry_.getMasterAccessManagement());
        _reviewableRequests = ReviewableRequests(registry_.getReviewableRequests());
    }

    function updateKYCRole(string calldata newKYCRole_) external onlyUpdatePermission {
        _updateKYCRole(newKYCRole_);
    }

    function requestKYC(string calldata KYCHash_) external override {
        UserRequestInfo storage requestInfo = usersRequestInfo[msg.sender];

        if (requestInfo.existingRequest) {
            require(
                !_isPendingReqest(requestInfo.requestId),
                "KYCRequests: user has a pending requests"
            );
        } else {
            requestInfo.existingRequest = true;
        }

        uint256 newRequestId_ = _reviewableRequests.nextRequestId();

        bytes memory acceptData_ = abi.encodeWithSelector(
            _masterAccess.grantRoles.selector,
            msg.sender,
            ArrayHelper.asArray(KYCRole)
        );
        string memory misc_ = uint256(uint160(msg.sender)).toHexString(20);

        _reviewableRequests.createRequest(
            address(_masterAccess),
            acceptData_,
            "",
            misc_,
            KYCHash_
        );

        requestInfo.requestId = newRequestId_;

        emit KYCRoleRequested(msg.sender, newRequestId_);
    }

    function dropKYCRequest() external {
        UserRequestInfo memory requestInfo_ = usersRequestInfo[msg.sender];

        require(requestInfo_.existingRequest, "KYCRequests: user has no request");
        require(
            _isPendingReqest(requestInfo_.requestId),
            "KYCRequests: user has no pending requests"
        );

        _reviewableRequests.dropRequest(requestInfo_.requestId);

        emit KYCRequestDropped(msg.sender, requestInfo_.requestId);
    }

    function _updateKYCRole(string calldata newKYCRole_) internal {
        require(bytes(newKYCRole_).length > 0, "KYCRequests: empty KYC role");

        KYCRole = newKYCRole_;

        emit KYCRoleUpdated(newKYCRole_);
    }

    function _isPendingReqest(uint256 requestId_) internal view returns (bool) {
        (IReviewableRequests.RequestStatus requestStatus_, , , , , ) = _reviewableRequests
            .requests(requestId_);

        return requestStatus_ == IReviewableRequests.RequestStatus.PENDING;
    }
}
