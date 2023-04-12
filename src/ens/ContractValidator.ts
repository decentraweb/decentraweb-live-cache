import {ethers, providers} from "ethers";
import {PublicResolver} from "@ensdomains/ens-contracts";

export enum ContractType {
  NOT_CONTRACT = 'not_contract',
  UNKNOWN_CONTRACT = 'unknown_contract',
  RESOLVER = 'resolver',
}

const METHODS = {
  addr: '0x3b3b57de',
  name: '0x691f3431',
}

class ContractValidator {
  private provider: providers.WebSocketProvider;

  constructor(provider: providers.WebSocketProvider) {
    this.provider = provider;
  }

  async isContract(address: string): Promise<boolean> {
    const code = await this.provider.getCode(address);
    console.log('code', code);
    return code !== '0x';
  }

  async validateContract(address: string): Promise<ContractType> {
    const bytecode = await this.provider.getCode(address);

    // No code : "0x" then functionA is definitely not there
    if (bytecode.length <= 2) {
      return ContractType.NOT_CONTRACT;
    }

    try {
      const contract = new ethers.Contract(address, PublicResolver, this.provider);
      const hasAddr = await contract.supportsInterface(METHODS.addr);
      const hasName = await contract.supportsInterface(METHODS.name);
      console.log('hasAddr, hasName', address, hasAddr, hasName);
      return hasAddr && hasName ? ContractType.RESOLVER : ContractType.UNKNOWN_CONTRACT;
    } catch (e) {
      console.log('error', e);
      return ContractType.UNKNOWN_CONTRACT;
    }

    // If the bytecode doesn't include the function selector functionA()
    // is definitely not present
    if (!bytecode.includes(METHODS.addr)) {
      console.log("addr(bytes32 node) method not found");
      return ContractType.UNKNOWN_CONTRACT;
    }

    if (!bytecode.includes(METHODS.name)) {
      console.log("name(bytes32 node) method not found");
      return ContractType.UNKNOWN_CONTRACT;
    }

    // Check if a fallback function is defined : if it is, we cannot answer
    try {
      await this.provider.estimateGas({ to: address });
      console.log(
        "Fallback is present : unable to decide if functionA() is present or not"
      );
      return ContractType.UNKNOWN_CONTRACT;
    } catch {}
    const contract = new ethers.Contract(address, PublicResolver, this.provider);
    // If gas estimation doesn't revert then an execution is possible
    // given the provided function selector
    try {
      await contract.estimateGas.addr();
      await contract.estimateGas.name();
      return ContractType.RESOLVER;
    } catch {
      // Otherwise (revert) we assume that there is no entry in the jump table
      // meaning that the contract doesn't include functionA()
      return ContractType.UNKNOWN_CONTRACT;
    }
  }


}

export default ContractValidator;
