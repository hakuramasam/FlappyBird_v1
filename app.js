import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom';
import htm from 'htm';

const html = htm.bind(React.createElement);

import { GMMC_CONTRACT, REWARD_POOL, MINT_FEE_AMOUNT } from './constants.js';
import { AudioManager } from './audio.js';
import { connectToBase, getGMMCBalance, transferFeeForMint, setWalletChangeCallback, getCurrentAccount } from './web3.js';
import { GameView } from './GameView.js';
import { getLeaderboard, saveScore, verifyScoreOnChain } from './supabase.js';
import { validateSocialHandle, sanitizeInput, generateUserId } from './validation.js';

const audioManager = new AudioManager();

function App() {
    const [gameState, setGameState] = useState('START');
    const [score, setScore] = useState(0);
    const [walletAddress, setWalletAddress] = useState(null);
    const [gmmcBalance, setGmmcBalance] = useState(0n);
    const [socialHandle, setSocialHandle] = useState('');
    const [isMinting, setIsMinting] = useState(false);
    const [isClaiming, setIsClaiming] = useState(false);
    const [showBuyLink, setShowBuyLink] = useState(false);
    const [leaderboard, setLeaderboard] = useState([]);
    const [lastRefresh, setLastRefresh] = useState(Date.now());
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const userIdRef = useRef(generateUserId());

    useEffect(() => {
        audioManager.init();
        const savedSocial = localStorage.getItem('gmmc_social');
        if (savedSocial) setSocialHandle(savedSocial);

        setWalletChangeCallback((event) => {
            if (event.type === 'accountsChanged') {
                setWalletAddress(event.account);
                if (event.account) {
                    fetchBalance(event.account);
                }
            } else if (event.type === 'disconnect') {
                setWalletAddress(null);
                setGmmcBalance(0n);
            }
        });

        fetchLeaderboard();
        const timer = setInterval(() => {
            fetchLeaderboard();
            setLastRefresh(Date.now());
        }, 30000);
        return () => clearInterval(timer);
    }, []);

    const fetchBalance = async (address) => {
        try {
            const balance = await getGMMCBalance(address);
            setGmmcBalance(balance);
        } catch (err) {
            console.error("Error fetching balance:", err);
            setError("Failed to fetch balance. Please try again.");
        }
    };

    const fetchLeaderboard = async () => {
        try {
            const data = await getLeaderboard();
            setLeaderboard(data);
        } catch (err) {
            console.error("Error fetching leaderboard:", err);
        }
    };

    const connectWallet = async () => {
        setError(null);
        try {
            const address = await connectToBase();
            setWalletAddress(address);
            await fetchBalance(address);
        } catch (err) {
            console.error("Wallet connection failed", err);
            setError(err.message || "Failed to connect wallet");
        }
    };

    const mintScoreOnChain = async () => {
        if (!walletAddress) {
            await connectWallet();
            return;
        }

        setError(null);
        setIsMinting(true);
        try {
            await fetchBalance(walletAddress);

            if (gmmcBalance < MINT_FEE_AMOUNT) {
                setShowBuyLink(true);
                setError(`Insufficient $GMMC. You need ${MINT_FEE_AMOUNT.toLocaleString()} $GMMC to mint.`);
                return;
            }

            const txHash = await transferFeeForMint();

            const verifyResult = await verifyScoreOnChain({
                user_id: userIdRef.current,
                score: score,
                wallet_address: walletAddress,
                social_handle: sanitizeInput(socialHandle),
                tx_hash: txHash,
                username: userIdRef.current,
            });

            if (!verifyResult.success) {
                setError("Score verification failed: " + verifyResult.error);
                return;
            }

            setError(null);
            await fetchLeaderboard();
            await fetchBalance(walletAddress);
        } catch (err) {
            console.error("Minting failed", err);
            setError(err.message || "Minting failed. Please try again.");
        } finally {
            setIsMinting(false);
        }
    };

    const startGame = () => {
        setGameState('PLAYING');
        setScore(0);
        setShowBuyLink(false);
        setError(null);
    };

    const handleGameOver = async (finalScore) => {
        setGameState('GAME_OVER');
        setScore(finalScore);
        audioManager.playSound('die');

        if (finalScore > 0) {
            try {
                const validation = validateSocialHandle(socialHandle);
                if (!validation.valid) {
                    setError(validation.error);
                    return;
                }

                const result = await saveScore(
                    userIdRef.current,
                    userIdRef.current,
                    finalScore,
                    walletAddress || '',
                    sanitizeInput(socialHandle) || 'Anonymous'
                );

                if (result.success) {
                    await fetchLeaderboard();
                } else {
                    console.error("Score save error:", result.error);
                }
            } catch (err) {
                console.error("Error saving score:", err);
            }
        }

        if (walletAddress) await fetchBalance(walletAddress);
    };

    const [showLeaderboard, setShowLeaderboard] = useState(false);

    const handleClaim = async () => {
        if (!walletAddress) {
            setError("Please connect your wallet first!");
            return;
        }
        setIsClaiming(true);
        setError(null);
        try {
            const sorted = leaderboard.slice().sort((a, b) => b.score - a.score);
            const rank = sorted.findIndex(e => e.wallet_address === walletAddress) + 1;

            if (rank > 0 && rank <= 10) {
                setError(`You are currently ranked #${rank}! Rewards are distributed every weekend on Base Network. Stay tuned!`);
            } else {
                setError("Only the top 10 players are currently eligible for this weekend's $GMMC distribution. Keep playing!");
            }
        } catch (err) {
            setError("Failed to check eligibility. Please try again.");
        } finally {
            setIsClaiming(false);
        }
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

                ${error && html`
                    <div style=${{position: 'fixed', top: '10px', left: '10px', right: '10px', backgroundColor: '#e74c3c', color: 'white', padding: '10px', borderRadius: '4px', fontSize: '10px', zIndex: 1000}}>
                        ${error}
                    </div>
                `}

                ${gameState === 'START' && html`
                    <div className="menu">
                        <h1 style=${{fontSize: '18px'}}>GMMC FLAPPY</h1>
                        <div style=${{fontSize: '8px', color: '#ffcc00', marginBottom: '10px'}}>WEEKLY POOL: ${REWARD_POOL}</div>
                        <div style=${{marginBottom: '10px'}}>
                            <input
                                type="text"
                                placeholder="X (Twitter) Handle"
                                value=${socialHandle}
                                onChange=${(e) => {
                                    const newHandle = e.target.value;
                                    setSocialHandle(newHandle);
                                    localStorage.setItem('gmmc_social', newHandle);
                                    setError(null);
                                }}
                                maxLength="100"
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
                        <div style=${{fontSize: '7px', marginTop: '5px'}}>Last Updated: ${new Date(lastRefresh).toLocaleTimeString()}</div>
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
                                        ${i + 1}. ${entry.user_id}
                                        ${entry.minted && html`<span className="verified-badge">On-Chain</span>`}
                                    </span>
                                    <span style=${{color: entry.minted ? '#00ff00' : '#ffffff'}}>${entry.score} PTS</span>
                                </div>
                                <div style=${{fontSize: '7px', color: '#888', marginTop: '4px'}}>
                                    ${entry.social_handle && html`<span>X: @${entry.social_handle}</span>`}
                                    <div style=${{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%'}}>
                                        Wallet: ${entry.wallet_address || 'Not Connected'}
                                    </div>
                                    ${entry.verified && html`<div style=${{color: '#00ff00'}}>On-Chain Verified (Base)</div>`}
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