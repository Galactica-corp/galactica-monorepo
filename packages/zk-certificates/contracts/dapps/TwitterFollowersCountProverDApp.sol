// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;
import {VerificationSBT} from '../SBT_related/VerificationSBT.sol';
import {ITwitterZkCertificateVerifier} from '../interfaces/ITwitterZkCertificateVerifier.sol';
import {TwitterRequirementsDemoDApp} from './TwitterRequirementsDemoDApp.sol';

/**
 * @title NonUSProverDApp
 * @author Galactica dev team
 * @notice A DApp to prove that twitter account has more than certain followers count
 */
contract TwitterFollowersCountProverDApp is TwitterRequirementsDemoDApp {
    constructor(
        ITwitterZkCertificateVerifier _verifierWrapper,
        string memory _uri,
        string memory _name,
        string memory _symbol
    ) TwitterRequirementsDemoDApp(_verifierWrapper, _uri, _name, _symbol) {}
}
