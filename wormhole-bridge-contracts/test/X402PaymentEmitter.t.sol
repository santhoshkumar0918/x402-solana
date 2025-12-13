// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {X402PaymentEmitter} from "../src/X402PaymentEmitter.sol";

/**
 * Mock Wormhole contract for testing
 */
contract MockWormhole {
    uint64 private sequence;
    
    function publishMessage(
        uint32 nonce,
        bytes memory payload,
        uint8 consistencyLevel
    ) external payable returns (uint64) {
        return ++sequence;
    }
    
    function messageFee() external pure returns (uint256) {
        return 0;
    }
}

/**
 * Mock USDC ERC20 contract for testing
 */
contract MockUSDC {
    mapping(address => uint256) public balances;
    mapping(address => mapping(address => uint256)) public allowances;
    
    function mint(address to, uint256 amount) external {
        balances[to] += amount;
    }
    
    function balanceOf(address account) external view returns (uint256) {
        return balances[account];
    }
    
    function transfer(address to, uint256 amount) external returns (bool) {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        balances[msg.sender] -= amount;
        balances[to] += amount;
        return true;
    }
    
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(allowances[from][msg.sender] >= amount, "Insufficient allowance");
        require(balances[from] >= amount, "Insufficient balance");
        allowances[from][msg.sender] -= amount;
        balances[from] -= amount;
        balances[to] += amount;
        return true;
    }
    
    function approve(address spender, uint256 amount) external returns (bool) {
        allowances[msg.sender][spender] = amount;
        return true;
    }
    
    function allowance(address owner, address spender) external view returns (uint256) {
        return allowances[owner][spender];
    }
}

/**
 * Comprehensive test suite for X402PaymentEmitter
 */
contract X402PaymentEmitterTest is Test {
    X402PaymentEmitter public emitter;
    MockWormhole public wormhole;
    MockUSDC public usdc;
    
    address public agent = address(0x123);
    address public owner;
    
    bytes32 public contentId = keccak256("test-content-id");
    bytes32 public sessionId = keccak256("test-session-id");
    bytes32 public nullifier = bytes32(0);
    uint256 public amount = 1_000_000; // 1 USDC (6 decimals)
    
    event PaymentEmitted(
        bytes32 indexed contentId,
        bytes32 indexed sessionId,
        address indexed payer,
        uint256 amount,
        uint64 sequence
    );
    
    event USDCWithdrawn(address indexed to, uint256 amount);
    
    function setUp() public {
        owner = address(this);
        
        // Deploy mock contracts
        wormhole = new MockWormhole();
        usdc = new MockUSDC();
        
        // Deploy X402PaymentEmitter
        emitter = new X402PaymentEmitter(address(wormhole), address(usdc));
        
        // Setup: Mint USDC to agent and approve emitter
        usdc.mint(agent, 10_000_000); // 10 USDC
        vm.prank(agent);
        usdc.approve(address(emitter), type(uint256).max);
    }
    
    // ============ Constructor Tests ============
    
    function test_Constructor() public view {
        assertEq(address(emitter.wormhole()), address(wormhole));
        assertEq(address(emitter.usdc()), address(usdc));
        assertEq(emitter.owner(), owner);
        assertEq(emitter.getCurrentNonce(), 0);
    }
    
    function test_RevertConstructorInvalidWormhole() public {
        vm.expectRevert("Invalid wormhole address");
        new X402PaymentEmitter(address(0), address(usdc));
    }
    
    function test_RevertConstructorInvalidUSDC() public {
        vm.expectRevert("Invalid USDC address");
        new X402PaymentEmitter(address(wormhole), address(0));
    }
    
    // ============ PayForContent Tests ============
    
    function test_PayForContent() public {
        uint256 agentBalanceBefore = usdc.balanceOf(agent);
        uint256 emitterBalanceBefore = usdc.balanceOf(address(emitter));
        
        vm.prank(agent);
        uint64 sequence = emitter.payForContent(
            contentId,
            sessionId,
            nullifier,
            amount
        );
        
        assertEq(sequence, 1);
        assertEq(usdc.balanceOf(agent), agentBalanceBefore - amount);
        assertEq(usdc.balanceOf(address(emitter)), emitterBalanceBefore + amount);
        assertEq(emitter.getCurrentNonce(), 1);
    }
    
    function test_PayForContentMultiple() public {
        // First payment
        vm.prank(agent);
        uint64 seq1 = emitter.payForContent(contentId, sessionId, nullifier, amount);
        assertEq(seq1, 1);
        
        // Second payment
        bytes32 contentId2 = keccak256("content-2");
        bytes32 sessionId2 = keccak256("session-2");
        
        vm.prank(agent);
        uint64 seq2 = emitter.payForContent(contentId2, sessionId2, nullifier, amount);
        assertEq(seq2, 2);
        
        assertEq(emitter.getCurrentNonce(), 2);
        assertEq(usdc.balanceOf(address(emitter)), amount * 2);
    }
    
    function test_PayForContentEmitsEvent() public {
        vm.prank(agent);
        
        vm.expectEmit(true, true, true, true);
        emit PaymentEmitted(contentId, sessionId, agent, amount, 1);
        
        emitter.payForContent(contentId, sessionId, nullifier, amount);
    }
    
    function test_PayForContentWithNullifier() public {
        bytes32 customNullifier = keccak256("custom-nullifier");
        
        vm.prank(agent);
        uint64 sequence = emitter.payForContent(
            contentId,
            sessionId,
            customNullifier,
            amount
        );
        
        assertEq(sequence, 1);
    }
    
    function testFuzz_PayForContentAmount(uint256 _amount) public {
        vm.assume(_amount > 0 && _amount <= 10_000_000); // Agent has 10 USDC
        
        vm.prank(agent);
        uint64 sequence = emitter.payForContent(contentId, sessionId, nullifier, _amount);
        
        assertEq(sequence, 1);
        assertEq(usdc.balanceOf(address(emitter)), _amount);
    }
    
    // ============ Revert Tests ============
    
    function test_RevertOnZeroContentId() public {
        vm.prank(agent);
        vm.expectRevert(X402PaymentEmitter.InvalidContentId.selector);
        emitter.payForContent(bytes32(0), sessionId, nullifier, amount);
    }
    
    function test_RevertOnZeroSessionId() public {
        vm.prank(agent);
        vm.expectRevert(X402PaymentEmitter.InvalidSessionId.selector);
        emitter.payForContent(contentId, bytes32(0), nullifier, amount);
    }
    
    function test_RevertOnZeroAmount() public {
        vm.prank(agent);
        vm.expectRevert(X402PaymentEmitter.InvalidAmount.selector);
        emitter.payForContent(contentId, sessionId, nullifier, 0);
    }
    
    function test_RevertOnInsufficientAllowance() public {
        address newAgent = address(0x456);
        usdc.mint(newAgent, 10_000_000);
        
        // Don't approve emitter
        vm.prank(newAgent);
        vm.expectRevert("Insufficient allowance");
        emitter.payForContent(contentId, sessionId, nullifier, amount);
    }
    
    function test_RevertOnInsufficientBalance() public {
        address poorAgent = address(0x789);
        usdc.mint(poorAgent, 100); // Only 0.0001 USDC
        
        vm.prank(poorAgent);
        usdc.approve(address(emitter), type(uint256).max);
        
        vm.prank(poorAgent);
        vm.expectRevert();
        emitter.payForContent(contentId, sessionId, nullifier, amount);
    }
    
    // ============ WithdrawUSDC Tests ============
    
    function test_WithdrawUSDC() public {
        // First, add some USDC to contract
        vm.prank(agent);
        emitter.payForContent(contentId, sessionId, nullifier, amount);
        
        // Withdraw as owner
        uint256 ownerBalanceBefore = usdc.balanceOf(owner);
        emitter.withdrawUSDC(owner, amount);
        
        assertEq(usdc.balanceOf(owner), ownerBalanceBefore + amount);
        assertEq(usdc.balanceOf(address(emitter)), 0);
    }
    
    function test_WithdrawUSDCEmitsEvent() public {
        vm.prank(agent);
        emitter.payForContent(contentId, sessionId, nullifier, amount);
        
        vm.expectEmit(true, false, false, true);
        emit USDCWithdrawn(owner, amount);
        
        emitter.withdrawUSDC(owner, amount);
    }
    
    function test_WithdrawUSDCPartial() public {
        // Add 10 USDC to contract
        vm.prank(agent);
        emitter.payForContent(contentId, sessionId, nullifier, amount * 10);
        
        // Withdraw only 5 USDC
        emitter.withdrawUSDC(owner, amount * 5);
        
        assertEq(usdc.balanceOf(address(emitter)), amount * 5);
    }
    
    function test_RevertWithdrawUnauthorized() public {
        vm.prank(agent);
        vm.expectRevert(X402PaymentEmitter.Unauthorized.selector);
        emitter.withdrawUSDC(agent, amount);
    }
    
    function testFuzz_WithdrawUSDC(uint256 withdrawAmount) public {
        vm.assume(withdrawAmount > 0 && withdrawAmount <= amount);
        
        // Add funds
        vm.prank(agent);
        emitter.payForContent(contentId, sessionId, nullifier, amount);
        
        // Withdraw
        emitter.withdrawUSDC(owner, withdrawAmount);
        
        assertEq(usdc.balanceOf(owner), withdrawAmount);
    }
    
    // ============ View Function Tests ============
    
    function test_GetCurrentNonce() public {
        assertEq(emitter.getCurrentNonce(), 0);
        
        vm.prank(agent);
        emitter.payForContent(contentId, sessionId, nullifier, amount);
        assertEq(emitter.getCurrentNonce(), 1);
        
        vm.prank(agent);
        emitter.payForContent(contentId, sessionId, nullifier, amount);
        assertEq(emitter.getCurrentNonce(), 2);
    }
    
    function test_GetUSDCBalance() public {
        assertEq(emitter.getUSDCBalance(), 0);
        
        vm.prank(agent);
        emitter.payForContent(contentId, sessionId, nullifier, amount);
        
        assertEq(emitter.getUSDCBalance(), amount);
    }
    
    function test_GetMessageFee() public view {
        assertEq(emitter.getMessageFee(), 0);
    }
    
    // ============ Integration Tests ============
    
    function test_FullWorkflow() public {
        // Step 1: Agent pays for content
        vm.prank(agent);
        uint64 sequence = emitter.payForContent(contentId, sessionId, nullifier, amount);
        
        // Verify state
        assertEq(sequence, 1);
        assertEq(usdc.balanceOf(address(emitter)), amount);
        
        // Step 2: Backend processes VAA (simulated by owner withdrawal)
        emitter.withdrawUSDC(owner, amount);
        
        // Verify final state
        assertEq(usdc.balanceOf(address(emitter)), 0);
        assertEq(usdc.balanceOf(owner), amount);
    }
}
