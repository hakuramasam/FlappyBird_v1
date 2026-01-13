import React, { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom';
import htm from 'htm';
import { ethers } from 'ethers';

const html = htm.bind(React.createElement);
const room = new WebsimSocket();

import { GMMC_CONTRACT, REWARD_POOL, MINT_FEE_AMOUNT } from './constants.js';
import { AudioManager } from './audio.js';
import { connectToBase, getGMMCBalance, transferFeeForMint } from './web3.js';
import { GameView } from './GameView.js';

// Global singleton for audio
const audioManager = new AudioManager();

function App() {
    const [gameState, setGameState] = useState('START'); // START, PLAYING, GAME_OVER, LEADERBOARD
    const [score, setScore] = useState(0);
    const [walletAddress, setWalletAddress] = useState(null);
    const [gmmcBalance, setGmmcBalance] = useState(0n);
    const [socialHandle, setSocialHandle] = useState('');
    const [isMinting, setIsMinting] = useState(false);
    const [isClaiming, setIsClaiming] = useState(false);
    const [showBuyLink, setShowBuyLink] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [lastRefresh, setLastRefresh] = useState(Date.now());

    // tombstone: removed constant GRAVITY, JUMP, PIPE_SPEED, PIPE_SPAWN_RATE, PIPE_GAP (moved to constants.js)
    // tombstone: removed constants GMMC_CONTRACT, TREASURY_ADDRESS, REWARD_POOL, MINT_FEE_AMOUNT, ERC20_ABI (moved to constants.js)
    // tombstone: removed canvasRef and gameRef (moved to GameView.js)

    const leaderboard = useSyncExternalStore(
        room.collection('leaderboard_v3').subscribe,
        room.collection('leaderboard_v3').getList
    );

    useEffect(() => {
        window.websim.getCurrentUser().then(setCurrentUser);
        audioManager.init();
        const savedSocial = localStorage.getItem('gmmc_social');
        if (savedSocial) setSocialHandle(savedSocial);

        // Simulated 5-minute data refresh cycle info
        const timer = setInterval(() => {
            setLastRefresh(Date.now());
        }, 300000); // 5 mins
        return () => clearInterval(timer);
    }, []);

    const fetchBalance = async (address) => {
        try {
            const balance = await getGMMCBalance(address);
            setGmmcBalance(balance);
        } catch (err) {
            console.error("Error fetching balance:", err);
        }
    };

    const connectWallet = async () => {
        try {
            const address = await connectToBase();
            setWalletAddress(address);
            await fetchBalance(address);
        } catch (err) {
            console.error("Wallet connection failed", err);
            alert(err.message || "Please connect your wallet to Base Network");
        }
    };

    const mintScoreOnChain = async () => {
        if (!walletAddress) {
            await connectWallet();
            return;
        }

        await fetchBalance(walletAddress);
        
        if (gmmcBalance < MINT_FEE_AMOUNT) {
            setShowBuyLink(true);
            alert(`Insufficient $GMMC. You need ${MINT_FEE_AMOUNT.toLocaleString()} $GMMC to mint.`);
            return;
        }

        setIsMinting(true);
        try {
            const txHash = await transferFeeForMint();
            alert("Transaction successful! Updating leaderboard...");
            
            const currentList = room.collection('leaderboard_v3').getList();
            const existing = currentList.find(l => l.username === currentUser.username);
            
            const entryData = {
                score: score,
                wallet: walletAddress,
                social: socialHandle || 'Anonymous',
                minted: true,
                txHash: txHash,
                verified: true
            };

            if (existing) {
                if (score >= existing.score) {
                    await room.collection('leaderboard_v3').update(existing.id, entryData);
                }
            } else {
                await room.collection('leaderboard_v3').create(entryData);
            }
            
            alert("Score successfully minted! Verified on Base Network.");
            await fetchBalance(walletAddress);
        } catch (err) {
            console.error("Minting failed", err);
            alert("Minting failed: " + (err.reason || err.message || "Unknown error"));
        } finally {
            setIsMinting(false);
        }
    };

    // tombstone: removed loadSound and playSound (moved to audio.js)
    // tombstone: removed assets ref and game loop useEffect (moved to GameView.js)

    const startGame = () => {
        setGameState('PLAYING');
        setScore(0);
        setShowBuyLink(false);
    };

    const handleGameOver = async (finalScore) => {
        setGameState('GAME_OVER');
        setScore(finalScore);
        audioManager.playSound('die');
        
        if (finalScore > 0 && currentUser) {
            const currentList = room.collection('leaderboard_v3').getList();
            const existing = currentList.find(l => l.username === currentUser.username);
            if (!existing || finalScore > existing.score) {
                const baseData = { 
                    score: finalScore, 
                    social: socialHandle || 'Anonymous',
                    wallet: walletAddress || 'Not Connected',
                    minted: false 
                };
                if (existing) {
                    await room.collection('leaderboard_v3').update(existing.id, baseData);
                } else {
                    await room.collection('leaderboard_v3').create(baseData);
                }
            }
        }
        if (walletAddress) await fetchBalance(walletAddress);
    };

    const [showLeaderboard, setShowLeaderboard] = useState(false);

    const handleClaim = async () => {
        if (!walletAddress) {
            alert("Please connect your wallet first!");
            return;
        }
        setIsClaiming(true);
        // Simulate checking eligibility for the 10M pool distribution
        const sorted = leaderboard.slice().sort((a,b) => b.score - a.score);
        const rank = sorted.findIndex(e => e.wallet === walletAddress) + 1;
        
        setTimeout(() => {
            if (rank > 0 && rank <= 10) {
                alert(`You are currently ranked #${rank}! Rewards are distributed every weekend on Base Network. Stay tuned!`);
            } else {
                alert("Only the top 10 players are currently eligible for this weekend's $GMMC distribution. Keep playing!");
            }
            setIsClaiming(false);
        }, 1500);
    };

    return html`
        <div className="game-container">
            <${GameView} 
                gameState=${gameState} 
                onGameOver=${handleGameOver} 
                onScore=${() => setScore(s => s + 1)} 
                audioManager=${audioManager} 
            />
            
            <div className="ui-overlay">
                <div className="score-display">${score}</div>
                
                ${gameState === 'START' && html`
                    <div className="menu">
                        <h1 style=${{fontSize: '18px'}}>GMMC FLAPPY</h1>
                        <div style=${{fontSize: '8px', color: '#ffcc00', marginBottom: '10px'}}>WEEKLY POOL: ${REWARD_POOL}</div>
                        <div style=${{marginBottom: '10px'}}>
                            <input 
                                type="text" 
                                placeholder="X (Twitter) Handle" 
                                value=${socialHandle}
                                onChange=${(e) => { setSocialHandle(e.target.value); localStorage.setItem('gmmc_social', e.target.value); }}
                                style=${{padding: '8px', fontSize: '10px', width: '80%', fontFamily: 'inherit', marginBottom: '5px'}}
                                onMouseDown=${(e) => e.stopPropagation()}
                            />
                            <button className="btn" style=${{fontSize: '10px', padding: '10px', backgroundColor: walletAddress ? '#2ecc71' : '#f39c12'}} onClick=${(e) => { e.stopPropagation(); connectWallet(); }}>
                                ${walletAddress ? 'WALLET CONNECTED' : 'CONNECT WALLET'}
                            </button>
                            ${walletAddress && html`
                                <div style=${{fontSize: '7px', marginTop: '5px', color: '#aaa'}}>
                                    Balance: ${Number(gmmcBalance).toLocaleString()} $GMMC
                                </div>
                            `}
                        </div>
                        <button className="btn" onClick=${startGame}>START GAME</button>
                        <button className="btn" style=${{backgroundColor: '#444'}} onClick=${(e) => { e.stopPropagation(); setShowLeaderboard(true); }}>LEADERBOARD</button>
                    </div>
                `}

                ${gameState === 'GAME_OVER' && html`
                    <div className="menu">
                        <h2>GAME OVER</h2>
                        <p>SCORE: ${score}</p>
                        <div style=${{fontSize: '8px', color: '#aaa', marginBottom: '10px'}}>Minting Fee: 15,000 $GMMC</div>
                        
                        <button 
                            className="btn" 
                            style=${{backgroundColor: '#e74c3c', display: 'block', width: '100%', marginBottom: '10px'}} 
                            onClick=${(e) => { e.stopPropagation(); mintScoreOnChain(); }}
                            disabled=${isMinting}
                        >
                            ${isMinting ? 'MINTING...' : 'MINT ON-CHAIN'}
                        </button>

                        ${showBuyLink && html`
                            <a href="https://app.uniswap.org/explore/tokens/base/${GMMC_CONTRACT}" target="_blank" className="btn" style=${{display: 'block', backgroundColor: '#3498db', textDecoration: 'none', fontSize: '10px'}} onMouseDown=${e=>e.stopPropagation()}>
                                BUY $GMMC ON UNISWAP
                            </a>
                        `}

                        <button className="btn" onClick=${startGame}>RETRY</button>
                        <button className="btn" style=${{backgroundColor: '#444'}} onClick=${(e) => { e.stopPropagation(); setShowLeaderboard(true); }}>LEADERBOARD</button>
                    </div>
                `}
            </div>

            ${showLeaderboard && html`
                <div className="leaderboard-overlay" onMouseDown=${(e) => e.stopPropagation()} onTouchStart=${(e) => e.stopPropagation()}>
                    <h2>LEADERBOARD</h2>
                    <div className="header-info">
                        <div className="token-info" style=${{fontSize: '7px'}}>TOKEN: ${GMMC_CONTRACT}</div>
                        <div className="countdown">Collect 10M Pool Distribution This Weekend</div>
                        <div style=${{color: '#ffcc00'}}>Weekly Pool: ${REWARD_POOL}</div>
                        <div style=${{fontSize: '7px', marginTop: '5px'}}>Next Sync in: ${Math.max(0, Math.ceil((300000 - (Date.now() - lastRefresh))/1000))}s</div>
                    </div>

                    ${walletAddress && html`
                        <div className="claim-banner" onClick=${handleClaim}>
                            ${isClaiming ? 'CHECKING ELIGIBILITY...' : 'CLAIM REWARDS (10M $GMMC POOL)'}
                        </div>
                    `}

                    <div className="leaderboard-list">
                        ${leaderboard.slice().sort((a,b) => b.score - a.score).map((entry, i) => html`
                            <div key=${entry.id} className="leaderboard-item" style=${{flexDirection: 'column', alignItems: 'flex-start', borderBottom: '1px solid #333', padding: '10px 0'}}>
                                <div style=${{display: 'flex', justifyContent: 'space-between', width: '100%'}}>
                                    <span style=${{display: 'flex', alignItems: 'center'}}>
                                        ${i + 1}. ${entry.username}
                                        ${entry.minted && html`<span className="verified-badge">On-Chain</span>`}
                                    </span>
                                    <span style=${{color: entry.minted ? '#00ff00' : '#ffffff'}}>${entry.score} PTS</span>
                                </div>
                                <div style=${{fontSize: '7px', color: '#888', marginTop: '4px'}}>
                                    ${entry.social && html`<span>X: @${entry.social}</span>`}
                                    <div style=${{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%'}}>
                                        Wallet: ${entry.wallet || 'None'}
                                    </div>
                                    ${entry.minted && html`<div style=${{color: '#00ff00'}}>On-Chain Proof Found (Base)</div>`}
                                </div>
                            </div>
                        `)}
                    </div>
                    <button className="btn" onClick=${() => setShowLeaderboard(false)}>CLOSE</button>
                </div>
            `}
        </div>
    `;
}

const container = document.getElementById('root');
const root = createRoot(container);
root.render(html`<${App} />`);