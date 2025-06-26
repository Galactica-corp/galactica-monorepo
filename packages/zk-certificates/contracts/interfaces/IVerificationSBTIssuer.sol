// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.28;

/// @author Galactica dev team

import {IVerificationSBT} from '../interfaces/IVerificationSBT.sol';

interface IVerificationSBTIssuer {
    function sbt() external view returns (IVerificationSBT);
}
