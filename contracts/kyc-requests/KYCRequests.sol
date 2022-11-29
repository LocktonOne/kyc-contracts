// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@dlsl/dev-modules/contracts-registry/AbstractDependant.sol";
import "@dlsl/dev-modules/libs/arrays/ArrayHelper.sol";

import "@tokene/core-contracts/core/MasterContractsRegistry.sol";
import "@tokene/core-contracts/core/MasterAccessManagement.sol";
import "@tokene/core-contracts/core/ReviewableRequests.sol";

import "../interfaces/kyc-requests/IKYCRequests.sol";

contract KYCRequests is IKYCRequests, AbstractDependant, Initializable {
    string public constant KYC_REQUESTS_DEP = "KYC_REQUESTS";

    string public override KYCRole;

    MasterAccessManagement internal _masterAccess;
    ReviewableRequests internal _reviewableRequests;

    mapping(address => UserRequestInfo) public override usersRequestInfo;

    function __KYCRequests_init(string calldata KYCRole_) external override initializer {
        require(bytes(KYCRole_).length > 0, "KYCRequests: empty KYC role");

        KYCRole = KYCRole_;
    }

    function setDependencies(address registryAddress_) public override dependant {
        MasterContractsRegistry registry_ = MasterContractsRegistry(registryAddress_);

        _masterAccess = MasterAccessManagement(registry_.getMasterAccessManagement());
        _reviewableRequests = ReviewableRequests(registry_.getReviewableRequests());
    }

    function requestKYCRole(string calldata KYCHash_) external override {
        UserRequestInfo storage requestInfo = usersRequestInfo[msg.sender];

        if (requestInfo.existingRequest) {
            require(
                _getRequestStatus(requestInfo.requestId) !=
                    (IReviewableRequests.RequestStatus.PENDING),
                "KYCRequests: user has a pending request"
            );
        } else {
            requestInfo.existingRequest = true;
        }

        bytes memory data_ = abi.encodeWithSelector(
            _masterAccess.grantRoles.selector,
            msg.sender,
            ArrayHelper.asArray(KYCRole)
        );

        uint256 newRequestId_ = _reviewableRequests.nextRequestId();

        _reviewableRequests.createRequest(address(_masterAccess), data_, "", KYCHash_);

        requestInfo.requestId = newRequestId_;

        emit KYCRoleRequested(msg.sender, newRequestId_);
    }

    function dropKYCRequest() external {
        UserRequestInfo memory requestInfo_ = usersRequestInfo[msg.sender];

        require(requestInfo_.existingRequest, "KYCRequests: user has no request");
        require(
            _getRequestStatus(requestInfo_.requestId) ==
                (IReviewableRequests.RequestStatus.PENDING),
            "KYCRequests: user has no pending request"
        );

        _reviewableRequests.dropRequest(requestInfo_.requestId);

        emit KYCRequestDropped(msg.sender, requestInfo_.requestId);
    }

    function _getRequestStatus(
        uint256 requestId_
    ) internal view returns (IReviewableRequests.RequestStatus) {
        (IReviewableRequests.RequestStatus requestStatus_, , , , ) = _reviewableRequests.requests(
            requestId_
        );

        return requestStatus_;
    }
}
