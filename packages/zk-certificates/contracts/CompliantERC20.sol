// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import './interfaces/IVerificationSBT.sol';

/**
 * @title CompliantERC20 is an ERC20 token that can only be transferred to accounts holding Galactica VerificationSBTs according to the compliance requirements.
 */
contract CompliantERC20 is ERC20, Ownable {
    // The compliance requirements are defined by a list of dApps.
    // Recipients must have received a VerificationSBT from each of these dApps to be compliant.
    address[] public compliancyRequirements;
    IVerificationSBT public verificationSBT;

    /**
     * @dev Constructor that initializes the token and mints the initial supply to the owner.
     * @param _name The name of the token.
     * @param _symbol The symbol of the token.
     * @param _owner The owner of the token.
     * @param _initialSupply The initial supply of the token.
     * @param _verificationSBT The address of the verificationSBT contract.
     * @param _compliantRequirements The list of dApps that define the compliance requirements.
     */
    constructor(
        string memory _name,
        string memory _symbol,
        address _owner,
        uint _initialSupply,
        address _verificationSBT,
        address[] memory _compliantRequirements
    ) ERC20(_name, _symbol) Ownable() {
        _mint(_owner, _initialSupply);
        verificationSBT = IVerificationSBT(_verificationSBT);
        compliancyRequirements = _compliantRequirements;
    }

    function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        for (uint i = 0; i < compliancyRequirements.length; i++) {
            require(
                verificationSBT.isVerificationSBTValid(
                    to,
                    compliancyRequirements[i]
                ),
                'CompliantERC20: Recipient does not have required compliance SBTs.'
            );
        }
        super._transfer(from, to, amount);
    }
}
