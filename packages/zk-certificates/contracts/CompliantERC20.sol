// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

/**
 * @title CompliantERC20 is an ERC20 token that can only be transferred to accounts holding Galactica VerificationSBTs according to the compliance requirements.
 */
contract CompliantERC20 is ERC20, Ownable {
    constructor(
        string memory name,
        string memory symbol,
        address owner,
        uint initialSupply
    ) ERC20(name, symbol) Ownable() {
        _mint(owner, initialSupply * 10 ** decimals());
    }
}
