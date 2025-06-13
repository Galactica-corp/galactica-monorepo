// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.28;

import {IVerifierWrapper} from './IVerifierWrapper.sol';
import {IGalacticaInstitution} from './IGalacticaInstitution.sol';
import {ICircomVerifier} from './ICircomVerifier.sol';

/// @author Galactica dev team
interface IAgeCitizenshipKYCVerifier is IVerifierWrapper {
    function fraudInvestigationInstitutions(
        uint index
    ) external view returns (IGalacticaInstitution);

    function getAmountFraudInvestigationInstitutions()
        external
        view
        returns (uint);

    function INDEX_USER_PUBKEY_AX() external view returns (uint8);

    function INDEX_USER_PUBKEY_AY() external view returns (uint8);

    function INDEX_IS_VALID() external view returns (uint8);

    function INDEX_ERROR() external view returns (uint8);

    function INDEX_VERIFICATION_EXPIRATION() external view returns (uint8);

    function START_INDEX_ENCRYPTED_DATA() external view returns (uint8);

    function INDEX_ROOT() external view returns (uint8);

    function INDEX_CURRENT_TIME() external view returns (uint8);

    function INDEX_USER_ADDRESS() external view returns (uint8);

    function INDEX_CURRENT_YEAR() external view returns (uint8);

    function INDEX_CURRENT_MONTH() external view returns (uint8);

    function INDEX_CURRENT_DAY() external view returns (uint8);

    function INDEX_AGE_THRESHOLD() external view returns (uint8);

    function INDEX_HUMAN_ID() external view returns (uint8);

    function INDEX_DAPP_ID() external view returns (uint8);

    function INDEX_PROVIDER_PUBKEY_AX() external view returns (uint8);

    function INDEX_PROVIDER_PUBKEY_AY() external view returns (uint8);

    function START_INDEX_INVESTIGATION_INSTITUTIONS()
        external
        view
        returns (uint8);

    function START_INDEX_COUNTRY_EXCLUSTIONS() external view returns (uint8);
}
