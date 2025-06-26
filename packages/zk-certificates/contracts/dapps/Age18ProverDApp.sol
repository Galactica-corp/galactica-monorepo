// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.28;
import {VerificationSBT} from '../SBT_related/VerificationSBT.sol';
import {IZkKYCVerifier} from '../interfaces/IZkKYCVerifier.sol';
import {BasicKYCExampleDApp} from './BasicKYCExampleDApp.sol';

/**
 * @title Age18ProverDApp
 * @author Galactica dev team
 * @notice A DApp to proof that users are at least 18 years old using zkKYC.
 */
contract Age18ProverDApp is BasicKYCExampleDApp {
    constructor(
        IZkKYCVerifier _verifierWrapper,
        string memory _uri,
        string memory _name,
        string memory _symbol
    ) BasicKYCExampleDApp(_verifierWrapper, _uri, _name, _symbol) {}
}
