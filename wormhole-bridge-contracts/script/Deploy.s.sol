// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {X402PaymentEmitter} from "../src/X402PaymentEmitter.sol";

/**
 * Deployment script for X402PaymentEmitter
 * 
 * Usage:
 * forge script script/Deploy.s.sol:DeployScript --rpc-url $BASE_SEPOLIA_RPC --broadcast --verify
 * 
 * Environment variables required:
 * - PRIVATE_KEY: Deployer private key
 * - WORMHOLE_CORE_ADDRESS: Wormhole Core contract address
 * - USDC_ADDRESS: USDC token address
 */
contract DeployScript is Script {
    function run() external {
        // Load environment variables
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address wormholeCore = vm.envAddress("WORMHOLE_CORE_ADDRESS");
        address usdcAddress = vm.envAddress("USDC_ADDRESS");
        
        console.log("Deploying X402PaymentEmitter...");
        console.log("Deployer:", vm.addr(deployerPrivateKey));
        console.log("Wormhole Core:", wormholeCore);
        console.log("USDC:", usdcAddress);
        
        vm.startBroadcast(deployerPrivateKey);
        
        X402PaymentEmitter emitter = new X402PaymentEmitter(
            wormholeCore,
            usdcAddress
        );
        
        vm.stopBroadcast();
        
        console.log("\n=== Deployment Successful ===");
        console.log("X402PaymentEmitter:", address(emitter));
        console.log("Owner:", emitter.owner());
        console.log("\nAdd this address to ALLOWED_EMITTERS in backend/src/bridge/bridge.service.ts");
    }
}
