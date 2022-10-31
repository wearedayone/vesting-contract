const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers');
const { expect } = require('chai');
require('chai').use(require('chai-as-promised')).should();

const { ethers } = require('hardhat');

const delay = (ms) =>
  new Promise((resolve, reject) => {
    setTimeout(resolve, ms);
  });

const Errors = {
  HasntStarted: 'Vesting program hasnt started yet',
  NotInVestingProgram: 'Address is not in vesting program',
  Received: 'Received this round. Please wait for next round to receive more!',
};

describe('VestingService', function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshopt in every test.
  async function deployVestingServiceFixture() {
    const [owner, ...otherAccounts] = await ethers.getSigners();

    const VestingService = await ethers.getContractFactory('VestingService');
    const vestingService = await VestingService.deploy();
    await vestingService.deployed();

    const TestToken = await ethers.getContractFactory('TestToken');
    const testToken = await TestToken.deploy(1e9);
    await testToken.deployed();

    return { vestingService, testToken, owner, otherAccounts };
  }

  describe('Deployment', function () {
    it('deploy VestingService', async function () {
      const { vestingService } = await loadFixture(deployVestingServiceFixture);
      expect(vestingService.address).not.to.be.undefined;
    });
    it('deploy TestToken ok', async function () {
      const { testToken, owner } = await loadFixture(
        deployVestingServiceFixture
      );
      const ownerBalance = await testToken.balanceOf(owner.address);
      expect(await testToken.totalSupply()).to.equal(ownerBalance);
    });
  });

  describe('Vesting schedule', function () {
    it('create vesting schedule', async function () {
      const { vestingService, testToken, owner, otherAccounts } =
        await loadFixture(deployVestingServiceFixture);

      const now = Date.now();
      const start = now + 10e3;
      const numberOfRounds = 10;
      const duration = 10e3;
      const initializedAmount = 10;
      const ownerBalance = await testToken.balanceOf(owner.address);
      const total = Number(ownerBalance.toString());
      const receiverAddresses = [owner, ...otherAccounts].map(
        (item) => item.address
      );

      const tokenReceivePerRound = Math.floor(
        (total - initializedAmount * receiverAddresses.length) /
          (numberOfRounds * receiverAddresses.length)
      );

      await testToken.approve(vestingService.address, total);

      await vestingService.createVestingSchedule(
        testToken.address,
        start,
        numberOfRounds,
        duration,
        initializedAmount,
        total,
        receiverAddresses
      );

      const [
        vestingScheduleToken,
        vestingScheduleStart,
        vestingScheduleDuration,
        vestingScheduleInitializedAmount,
        vestingScheduleTokenReceivePerRound,
        vestingScheduleReleased,
        vestingScheduleTotal,
      ] = await vestingService.getVestingSchedule(testToken.address);

      expect(vestingScheduleToken).to.equal(testToken.address);
      expect(Number(vestingScheduleStart.toString())).to.equal(start);
      expect(Number(vestingScheduleDuration.toString())).to.equal(duration);
      expect(Number(vestingScheduleInitializedAmount.toString())).to.equal(
        initializedAmount
      );
      expect(Number(vestingScheduleTokenReceivePerRound.toString())).to.equal(
        tokenReceivePerRound
      );
      expect(Number(vestingScheduleReleased.toString())).to.equal(
        initializedAmount * receiverAddresses.length
      );
      expect(Number(vestingScheduleTotal.toString())).to.equal(total);

      const holderBalance =
        await vestingService.getVestingScheduleHolderBalance(testToken.address);
      expect(Number(holderBalance.toString())).to.equal(initializedAmount);

      const receiverBalance = await testToken.balanceOf(receiverAddresses[0]);
      expect(receiverBalance).to.equal(initializedAmount);

      const newOwnerBalance = await testToken.balanceOf(owner.address);
      expect(Number(newOwnerBalance.toString())).to.equal(
        Number(ownerBalance.toString()) - total + initializedAmount
      );
    });

    it('release failed due to address not in vesting program', async function () {
      const { vestingService, testToken, owner, otherAccounts } =
        await loadFixture(deployVestingServiceFixture);

      const now = Date.now();
      const start = now + 10e3;
      const numberOfRounds = 10;
      const duration = 10e3;
      const initializedAmount = 10;
      const ownerBalance = await testToken.balanceOf(owner.address);
      const total = Number(ownerBalance.toString());
      const receiverAddresses = otherAccounts.map((item) => item.address);

      await testToken.approve(vestingService.address, total);

      await vestingService.createVestingSchedule(
        testToken.address,
        start,
        numberOfRounds,
        duration,
        initializedAmount,
        total,
        receiverAddresses
      );

      vestingService
        .release(testToken.address)
        .should.be.rejectedWith(Errors.NotInVestingProgram);
    });

    it('release failed due to vesting program hasnt started yet', async function () {
      const { vestingService, testToken, owner, otherAccounts } =
        await loadFixture(deployVestingServiceFixture);

      const now = Date.now();
      const start = now + 10e3;
      const numberOfRounds = 10;
      const duration = 10e3;
      const initializedAmount = 10;
      const ownerBalance = await testToken.balanceOf(owner.address);
      const total = Number(ownerBalance.toString());
      const receiverAddresses = [owner, ...otherAccounts].map(
        (item) => item.address
      );

      await testToken.approve(vestingService.address, total);

      await vestingService.createVestingSchedule(
        testToken.address,
        start,
        numberOfRounds,
        duration,
        initializedAmount,
        total,
        receiverAddresses
      );

      vestingService
        .release(testToken.address)
        .should.be.rejectedWith(Errors.HasntStarted);
    });

    it('release failed due to received', async function () {
      const { vestingService, testToken, owner, otherAccounts } =
        await loadFixture(deployVestingServiceFixture);

      const now = Date.now();
      const start = now + 10e3;
      const numberOfRounds = 10;
      const duration = 10e3;
      const initializedAmount = 10;
      const ownerBalance = await testToken.balanceOf(owner.address);
      const total = Number(ownerBalance.toString());
      const receiverAddresses = [owner, ...otherAccounts].map(
        (item) => item.address
      );

      await testToken.approve(vestingService.address, total);

      await vestingService.createVestingSchedule(
        testToken.address,
        start,
        numberOfRounds,
        duration,
        initializedAmount,
        total,
        receiverAddresses
      );

      await delay(10e3);

      vestingService
        .release(testToken.address)
        .should.be.rejectedWith(Errors.Received);
    });

    it('release successfully', async function () {
      const { vestingService, testToken, owner, otherAccounts } =
        await loadFixture(deployVestingServiceFixture);

      const now = Date.now();
      const start = now + 10e3;
      const numberOfRounds = 10;
      const duration = 10e3;
      const initializedAmount = 10;
      const ownerBalance = await testToken.balanceOf(owner.address);
      const total = Number(ownerBalance.toString());
      const receiverAddresses = [owner, ...otherAccounts].map(
        (item) => item.address
      );

      const tokenReceivePerRound = Math.floor(
        (total - initializedAmount * receiverAddresses.length) /
          (numberOfRounds * receiverAddresses.length)
      );

      await testToken.approve(vestingService.address, total);

      await vestingService.createVestingSchedule(
        testToken.address,
        start,
        numberOfRounds,
        duration,
        initializedAmount,
        total,
        receiverAddresses
      );

      await delay(10e3);
      await delay(10e3);

      await vestingService.release(testToken.address);

      const balanceAfterReleasing = initializedAmount + tokenReceivePerRound;

      const newBalance = await testToken.balanceOf(owner.address);
      expect(Number(newBalance.toString())).to.equal(balanceAfterReleasing);

      const holderBalance =
        await vestingService.getVestingScheduleHolderBalance(testToken.address);
      expect(Number(holderBalance.toString())).to.equal(balanceAfterReleasing);
    });
  });
});
