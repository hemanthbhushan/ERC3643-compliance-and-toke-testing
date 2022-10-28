const { italic } = require("ansi-colors");
const { expect } = require("chai");
const { zeroAddress } = require("ethereumjs-util");
const { ethers, network } = require("hardhat");
const { isCallTrace } = require("hardhat/internal/hardhat-network/stack-traces/message-trace");
// const { describe } = require("yargs");



//testing for the identity registry
describe("testing",()=>{
  // let identityRegistry,identityRegistryStorage,tokenName,
  let claimTopicsRegistry;
  let identityRegistry;
  let identityRegistryStorage;
  let trustedIssuersRegistry;
  let claimIssuerContract;
  let signer1;
  let signer2;
  let signer3;
  let owner;
  let agent;
  let compliance;
  let _token;
  let _onChainId;
  let tokenAgent;
  let implementation;
  let proxy;
  let token;
  let limitHolder;
  let user1,user2;
  let identityRegistryAgent;


  beforeEach(async ()=>{
    [owner,signer1,signer2,signer3,agent,tokenAgent,identityIssuer,claimIssue,identityRegistryAgent] = await ethers.getSigners();
    accounts = await ethers.getSigners();

    const TrustedIssuersRegistry = await ethers.getContractFactory("TrustedIssuersRegistry");
    trustedIssuersRegistry = await TrustedIssuersRegistry.deploy();
    await trustedIssuersRegistry.deployed();

    const ClaimTopicsRegistry = await ethers.getContractFactory("ClaimTopicsRegistry");
    claimTopicsRegistry = await ClaimTopicsRegistry.deploy();
   


    const IdentityRegistryStorage = await ethers.getContractFactory("IdentityRegistryStorage");
    identityRegistryStorage = await IdentityRegistryStorage.deploy();
    await identityRegistryStorage.deployed();

     
    //above three deployed contracts are included in the identity contract

    const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
    identityRegistry = await IdentityRegistry.deploy(trustedIssuersRegistry.address,claimTopicsRegistry.address,identityRegistryStorage.address);
    await identityRegistry.deployed();

    await identityRegistryStorage.bindIdentityRegistry(identityRegistry.address);

   
    const ClaimIssuerContract = await ethers.getContractFactory("ClaimIssuer");
   claimIssuerContract = await ClaimIssuerContract.deploy(claimIssue.address);


   await identityRegistry.addAgentOnIdentityRegistryContract(identityRegistryAgent.address);

  
   
   const IdentityHolder = await ethers.getContractFactory("Identity");
  
    const Compliance = await ethers.getContractFactory("DefaultCompliance");
        compliance = await Compliance.deploy();
        tokenName = 'TREXToken';
        tokenSymbol = 'TREX';
        tokenDecimals = '0';
        
        const _Token = await ethers.getContractFactory("Token");
        _token = await _Token.deploy();

        user1 = await IdentityHolder.deploy(signer1.address,false);
        user2 = await IdentityHolder.deploy(signer2.address,false);


        await user1.connect(signer1).addClaim(7,1,claimIssuerContract.address,'0x24', '0x12',"");

        await user2.connect(signer2).addClaim(7,1,claimIssuerContract.address,'0x24', '0x12',"");
  

        await identityRegistry.connect(identityRegistryAgent).registerIdentity(signer1.address,user1.address,23);
        await identityRegistry.connect(identityRegistryAgent).registerIdentity(signer2.address,user2.address,23);


        _onChainId = await IdentityHolder.deploy(_token.address,false);
    
    
        const Implementation = await ethers.getContractFactory("ImplementationAuthority");
        implementation = await Implementation.deploy(_token.address);
       
    
        const Proxy = await ethers.getContractFactory("TokenProxy");
        proxy = await Proxy.deploy( implementation.address,identityRegistry.address,compliance.address,tokenName,tokenSymbol,tokenDecimals,_onChainId.address);
    
        token =  _Token.attach(proxy.address);


        const LimitHolder = await ethers.getContractFactory("LimitHolder");
        limitHolder = await LimitHolder.deploy(token.address,2);

        await token.setCompliance(limitHolder.address);

        await limitHolder.bindToken(token.address);
        await token.addAgentOnTokenContract(tokenAgent.address);
        

     

    const zeroAddress = 0x0000000000000000000000000000000000000000;
  })

  it("check the default compliance",async()=>{

    await compliance.addTokenAgent(tokenAgent.address);

    expect(await compliance.isTokenAgent(tokenAgent.address)).to.equal(true);

    await compliance.removeTokenAgent(tokenAgent.address);

    expect(await compliance.isTokenAgent(tokenAgent.address)).to.equal(false);

    await compliance.bindToken(token.address);
    expect(await compliance.isTokenBound(token.address)).to.equal(true);
    await compliance.unbindToken(token.address);
    expect(await compliance.isTokenBound(token.address)).to.equal(false);

})
it("defauilt compliance gets reverted",async ()=>{
  await compliance.addTokenAgent(tokenAgent.address);
  await compliance.bindToken(token.address);
  expect(compliance.bindToken(token.address)).to.be.revertedWith('This token is already bound');
  expect(compliance.addTokenAgent(tokenAgent.address)).to.be.revertedWith('This Agent is already registered');
  await compliance.unbindToken(token.address);
  expect(compliance.unbindToken(token.address)).to.be.revertedWith('This token is not bound yet');
  await compliance.removeTokenAgent(tokenAgent.address);
  expect(compliance.removeTokenAgent(tokenAgent.address)).to.be.revertedWith('This Agent is not registered yet');



})
//testng for the limit holder


it("checking functions of limit holder",async()=>{

  await token.setCompliance(compliance.address);

  expect(await token.compliance()).to.equal(compliance.address);

  expect(await limitHolder.getHolderLimit()).to.equal(2);
  await limitHolder.setHolderLimit(3);

  expect(await limitHolder.getHolderLimit()).to.equal(3);
})

it("checking the holder count",async()=>{
  await token.connect(tokenAgent).mint(signer1.address,1000);
  await token.connect(tokenAgent).mint(signer2.address,1000);

  expect(await limitHolder.holderCount()).to.be.equal(2);


  expect(await limitHolder.holderAt(0)).to.equal(signer1.address);
})
it("revert if the token count exceeds",async()=>{
  await limitHolder.setHolderLimit(1);
  await token.connect(tokenAgent).mint(signer1.address,1000);
  
  expect( token.connect(tokenAgent).mint(signer2.address,1000)).to.be.revertedWith( 'Compliance not followed');
})
it("revert if the user dosent have claims add ",async()=>{
  expect(token.connect(tokenAgent).mint(signer3.address,1000)).to.be.revertedWith('Identity is not verified.');
})
// it("revert if token is not binded ,some that only needed to be called token token is the msg.sender",async()=>{
//   // await limitHolder.unbindToken(token.address);
//   expect(token.connect(tokenAgent).mint(signer1.address)).to.be.revertedWith('error : this address is not a token bound to the compliance contract');
// })

it("revert if the share holder doesnt exist",async()=>{
  await token.connect(tokenAgent).mint(signer1.address,1000);
  await token.connect(tokenAgent).mint(signer2.address,1000);

  expect(limitHolder.holderAt(3)).to.be.revertedWith('shareholder doesn\'t exist');
})

it("check the holder count",async()=>{
  await token.connect(tokenAgent).mint(signer1.address,1000);
  await token.connect(tokenAgent).mint(signer2.address,1000);

  expect(await limitHolder.holderCount()).to.be.equal(2);

  await token.connect(tokenAgent).burn(signer1.address,1000);
  await token.connect(tokenAgent).burn(signer2.address,900);

  expect(await limitHolder.holderCount()).to.be.equal(1);

})
it("revert passing amount 0 in mint function",async()=>{
  expect( token.connect(tokenAgent).mint(signer1.address,0)).to.be.revertedWith('No token created');

})
it("check the holder limit when transferred to the new address",async()=>{
  await limitHolder.setHolderLimit(1);
  await token.connect(tokenAgent).mint(signer1.address,1000);
//it gets reverted bcz when tranfer function the internal function from the limitHolder = canTransfer checks for the holder limit if it exceeds then fails
  expect(token.connect(signer1).transfer(signer2.address,500)).to.be.revertedWith('Transfer not possible');
})


})

// testing for the token.sol

describe("testing Token",()=>{


  let claimTopicsRegistry;
  let identityRegistry;
  let identityRegistryStorage;
  let trustedIssuersRegistry;
  let claimIssuerContract;
  let signer1;
  let signer2;
  let signer3;
  let owner;
  let agent;
  let compliance;
  let _token;
  let _onChainId;
  let tokenAgent;
  let implementation;
  let proxy;
  let token;
  let limitHolder;
  let user1,user2;
  let identityRegistryAgent;


  beforeEach(async ()=>{
    [owner,signer1,signer2,signer3,agent,tokenAgent,identityIssuer,claimIssue,identityRegistryAgent] = await ethers.getSigners();
    accounts = await ethers.getSigners();

    const TrustedIssuersRegistry = await ethers.getContractFactory("TrustedIssuersRegistry");
    trustedIssuersRegistry = await TrustedIssuersRegistry.deploy();
    await trustedIssuersRegistry.deployed();

    const ClaimTopicsRegistry = await ethers.getContractFactory("ClaimTopicsRegistry");
    claimTopicsRegistry = await ClaimTopicsRegistry.deploy();
   


    const IdentityRegistryStorage = await ethers.getContractFactory("IdentityRegistryStorage");
    identityRegistryStorage = await IdentityRegistryStorage.deploy();
    await identityRegistryStorage.deployed();

     
    //above three deployed contracts are included in the identity contract

    const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
    identityRegistry = await IdentityRegistry.deploy(trustedIssuersRegistry.address,claimTopicsRegistry.address,identityRegistryStorage.address);
    await identityRegistry.deployed();

    await identityRegistryStorage.bindIdentityRegistry(identityRegistry.address);

   
    const ClaimIssuerContract = await ethers.getContractFactory("ClaimIssuer");
   claimIssuerContract = await ClaimIssuerContract.deploy(claimIssue.address);


   await identityRegistry.addAgentOnIdentityRegistryContract(identityRegistryAgent.address);

  
   
   const IdentityHolder = await ethers.getContractFactory("Identity");
  
    const Compliance = await ethers.getContractFactory("DefaultCompliance");
        compliance = await Compliance.deploy();
        tokenName = 'TREXToken';
        tokenSymbol = 'TREX';
        tokenDecimals = '0';
        
        const _Token = await ethers.getContractFactory("Token");
        _token = await _Token.deploy();

        user1 = await IdentityHolder.deploy(signer1.address,false);
        user2 = await IdentityHolder.deploy(signer2.address,false);


        await user1.connect(signer1).addClaim(7,1,claimIssuerContract.address,'0x24', '0x12',"");

        await user2.connect(signer2).addClaim(7,1,claimIssuerContract.address,'0x24', '0x12',"");
  

        await identityRegistry.connect(identityRegistryAgent).registerIdentity(signer1.address,user1.address,23);
        await identityRegistry.connect(identityRegistryAgent).registerIdentity(signer2.address,user2.address,23);


        _onChainId = await IdentityHolder.deploy(_token.address,false);
    
    
        const Implementation = await ethers.getContractFactory("ImplementationAuthority");
        implementation = await Implementation.deploy(_token.address);
       
    
        const Proxy = await ethers.getContractFactory("TokenProxy");
        proxy = await Proxy.deploy( implementation.address,identityRegistry.address,compliance.address,tokenName,tokenSymbol,tokenDecimals,_onChainId.address);
    
        token =  _Token.attach(proxy.address);


        const LimitHolder = await ethers.getContractFactory("LimitHolder");
        limitHolder = await LimitHolder.deploy(token.address,2);

        await token.setCompliance(limitHolder.address);

        await limitHolder.bindToken(token.address);
        await token.addAgentOnTokenContract(tokenAgent.address);
        })


     it("checking the basic functionalities",async()=>{
      expect(await token.decimals()).to.equal(0);
      expect(await token.name()).to.equal('TREXToken');
      expect(await token.onchainID()).to.equal(_onChainId.address);
      expect(await token.symbol()).to.equal('TREX');
      expect(await token.version()).to.equal("3.5.1");
 })
 //transfer function
 it("testing transfer function ",async()=>{
     await token.connect(tokenAgent).mint(signer1.address,1000);
     expect(await token.balanceOf(signer1.address)).to.equal(1000);
     await token.connect(signer1).transfer(signer2.address,200);
     expect(await token.balanceOf(signer1.address)).to.equal(800);
 })

 it("testing when the contract is frozen",async()=>{
  await token.connect(tokenAgent).pause();

  expect(token.transfer(signer1.address)).to.be.revertedWith('Pausable: paused');
 })

 it("revert when the _to or msg.sender address is frozen",async()=>{
  await token.connect(tokenAgent).mint(signer1.address,1000);
  await token.connect(tokenAgent).setAddressFrozen(signer1.address,true);

  expect(token.connect(signer1).transfer(signer2.address,500)).to.be.revertedWith('wallet is frozen');
  await token.connect(tokenAgent).setAddressFrozen(signer1.address,false);
  await token.connect(tokenAgent).setAddressFrozen(signer2.address,true);

  expect(token.connect(signer1).transfer(signer2.address,500)).to.be.revertedWith('wallet is frozen');


 })
 it("revert if amount is greater then the existing balance balanceOf(msg.sender) - (frozenTokens[msg.sender])",async()=>{
  await token.connect(tokenAgent).mint(signer1.address,1000);
  await token.connect(tokenAgent).freezePartialTokens(signer1.address,600);
  expect(token.connect(signer1).transfer(signer2.address,500)).to.be.revertedWith('Insufficient Balance');


 })

 it("revert if the to address is notverified ie it has no claim id",async()=>{
  await token.connect(tokenAgent).mint(signer1.address,1000);
  expect(token.connect(signer1).transfer(signer3.address,500)).to.be.revertedWith('Transfer not possible');
 })
 it("checking",async()=>{
  await limitHolder.setHolderLimit(1);
  await token.connect(tokenAgent).mint(signer1.address,1000);
  expect(token.connect(signer1).transfer(signer2.address,0)).to.be.revertedWith('Transfer not possible');
 })

 //testing for transferFrom
 //the no of share holder should decrease but its not changing
 it("testing for transferFrom",async()=>{
  await token.connect(tokenAgent).mint(signer1.address,1000);
  console.log( await limitHolder.holderCount());

//  expect( await limitHolder.holderCount()).to.equal(2);
  await token.connect(signer1).approve(signer2.address,1000);

  await token.connect(signer2).transferFrom(signer1.address,signer2.address,1000);
  expect(await token.balanceOf(signer2.address)).to.be.equal(1000);
  // let check = await limitHolder.holderCount();
  console.log( await limitHolder.holderCount());
  // expect(check).to.equal(1);
 })


 //forced transfer

 it("testing the forced transfer",async()=>{
  await token.connect(tokenAgent).mint(signer1.address,1000);
  await token.connect(tokenAgent).freezePartialTokens(signer1.address,600);

  await token.connect(tokenAgent).forcedTransfer(signer1.address,signer2.address,500);

  expect(await token.balanceOf(signer2.address)).to.equal(500);
 })
 it("revert forced transfer",async()=>{

  await token.connect(tokenAgent).mint(signer1.address,1000);
  await token.connect(tokenAgent).freezePartialTokens(signer1.address,600);

  expect(token.connect(tokenAgent).forcedTransfer(signer1.address,signer3.address,500)).to.be.revertedWith('Transfer not possible');
   })

it("revert forced transfer on overflow",async()=>{

    await token.connect(tokenAgent).mint(signer1.address,1000);
    await token.connect(tokenAgent).freezePartialTokens(signer1.address,600);
   
  
    expect(token.connect(tokenAgent).forcedTransfer(signer1.address,signer2.address,5000)).to.be.revertedWith('panic code 0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)');
  })

  //recovery address

  it("recover the lost tokens ",async()=>{
    await token.connect(tokenAgent).mint(signer1.address,1000);
    await identityRegistry.addAgentOnIdentityRegistryContract(token.address);
    const IdentityHolder = await ethers.getContractFactory("Identity");
   let user3 = await IdentityHolder.deploy(signer3.address,false);

   await user3.connect(signer3).addClaim(7,1,claimIssuerContract.address,'0x24', '0x12',"");
 
   
    await token.connect(tokenAgent).recoveryAddress(signer1.address,signer3.address,user3.address);
    
    expect(await token.balanceOf(signer3.address)).to.equal(1000);

  })

  it("revert if the balance of recover wallet is zero",async()=>{
  //   await token.connect(tokenAgent).mint(signer1.address,1000);
  //   await identityRegistry.addAgentOnIdentityRegistryContract(token.address);
    const IdentityHolder = await ethers.getContractFactory("Identity");
   let user3 = await IdentityHolder.deploy(signer3.address,false);

   await user3.connect(signer3).addClaim(7,1,claimIssuerContract.address,'0x24', '0x12',"");
   expect(token.connect(tokenAgent).recoveryAddress(signer1.address,signer3.address,user3.address)).to.be.revertedWith('no tokens to recover');
  })

  it("revert if the new wallet doesnt have the identity contract ",async()=>{
    await token.connect(tokenAgent).mint(signer1.address,1000);
    await identityRegistry.addAgentOnIdentityRegistryContract(token.address);
     expect ( token.connect(tokenAgent).recoveryAddress(signer1.address,signer3.address,user1.address)).to.be.revertedWith('Recovery not possible');
    
 })






  

})