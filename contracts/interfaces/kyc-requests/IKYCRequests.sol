// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface IKYCRequests {
    struct UserRequestInfo {
        uint256 requestId;
        bool existingRequest;
    }

    event KYCRoleRequested(address userAddr, uint256 requestId);
    event KYCRequestDropped(address userAddr, uint256 requestId);

    function __KYCRequests_init(string calldata KYCRole_) external;

    function requestKYCRole(string calldata KYCHash_) external;

    function dropKYCRequest() external;

    function KYCRole() external view returns (string memory);

    function usersRequestInfo(address userAddr_) external view returns (uint256, bool);
}
