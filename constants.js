export const GRAVITY = 0.25;
export const JUMP = -4.5;
export const PIPE_SPEED = 2.5;
export const PIPE_SPAWN_RATE = 100; // frames
export const PIPE_GAP = 140;

export const GMMC_CONTRACT = "0x3D9B15274E579411555FF1F96fE9E1ABf3Df4b07";
export const TREASURY_ADDRESS = "0xDB698260C7461e2168231e04427c81FcAd221611";
export const REWARD_POOL = "10,000,000 $GMMC";
export const MINT_FEE_AMOUNT = 15000n; // 15,000 $GMMC

export const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function decimals() view returns (uint8)"
];