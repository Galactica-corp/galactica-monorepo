// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.28;

import {IGuardianRegistry} from './IGuardianRegistry.sol';
import {IReadableZkCertRegistry} from './IReadableZkCertRegistry.sol';
import {IWritableZKCertRegistry} from './IWritableZKCertRegistry.sol';

/// @author Galactica dev team
interface IZkCertificateRegistry is
    IReadableZkCertRegistry,
    IWritableZKCertRegistry
{

}
