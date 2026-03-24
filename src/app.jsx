import React from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import './app.css';
import './utils/tilt';
import { Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { Login } from './login/login';
import { AuthState } from './login/authState';
import { Deck } from './deck/deck';
import { Designer } from './designer/designer';
import { Packs } from './packs/packs';
import { Trades } from './trades/trades';
import { Bank } from './bank/bank';
import { Leaderboard } from './leaderboard/leaderboard';
import { Approve } from './approve/approve';
import { AdminCards } from './adminCards/adminCards';
import { getMe, getProfile, logoutAuth } from './login/authService';
import { gameApiClient } from '../service/gameApiClient';
import { tradeRealtimeClient } from '../service/tradeRealtimeClient';

const EMPTY_TRADE_REQUEST = { fromUserName: '', fromUserLabel: '' };
const TRADE_REQUEST_STORAGE_KEY = 'fjord:incomingTradeRequest';
const TRADE_REQUEST_DISMISS_STORAGE_KEY = 'fjord:incomingTradeDismissed';

export default function App() {

        const [userName, setUserName] = React.useState('');
    const [authState, setAuthState] = React.useState(AuthState.Unknown);
    const [profile, setProfile] = React.useState({ username: '', admin: false, wallet: 0 });
        const [incomingTradeRequest, setIncomingTradeRequest] = React.useState(EMPTY_TRADE_REQUEST);
        const [dismissedTradeFromUserName, setDismissedTradeFromUserName] = React.useState('');
    const isAdminUser = Boolean(profile?.admin);
  const navigate = useNavigate();

        const clearIncomingTradeRequestStateOnly = React.useCallback(() => {
            setIncomingTradeRequest(EMPTY_TRADE_REQUEST);
        }, []);

        const clearDismissedTradeNoticeStateOnly = React.useCallback(() => {
            setDismissedTradeFromUserName('');
        }, []);

        const setDismissedTradeNoticeAndPersist = React.useCallback((fromUserName) => {
            const normalized = String(fromUserName || '').trim();
            setDismissedTradeFromUserName(normalized);

            if (!userName) {
                return;
            }

            if (!normalized) {
                window.localStorage.removeItem(TRADE_REQUEST_DISMISS_STORAGE_KEY);
                return;
            }

            window.localStorage.setItem(TRADE_REQUEST_DISMISS_STORAGE_KEY, JSON.stringify({
                forUserName: userName,
                fromUserName: normalized,
            }));
        }, [userName]);

        const setIncomingTradeRequestAndPersist = React.useCallback((nextRequest) => {
            const normalized = {
                fromUserName: String(nextRequest?.fromUserName || '').trim(),
                fromUserLabel: String(nextRequest?.fromUserLabel || nextRequest?.fromUserName || '').trim(),
            };

            setIncomingTradeRequest(normalized);

            if (!userName) {
                return;
            }

            if (!normalized.fromUserName) {
                window.localStorage.removeItem(TRADE_REQUEST_STORAGE_KEY);
                window.localStorage.removeItem(TRADE_REQUEST_DISMISS_STORAGE_KEY);
                setDismissedTradeFromUserName('');
                return;
            }

            window.localStorage.setItem(TRADE_REQUEST_STORAGE_KEY, JSON.stringify({
                forUserName: userName,
                fromUserName: normalized.fromUserName,
                fromUserLabel: normalized.fromUserLabel || normalized.fromUserName,
            }));
        }, [userName]);

        const clearIncomingTradeRequest = React.useCallback(() => {
            setIncomingTradeRequestAndPersist(EMPTY_TRADE_REQUEST);
        }, [setIncomingTradeRequestAndPersist]);

        const restoreIncomingTradeRequestForUser = React.useCallback(() => {
            if (!userName) {
                clearIncomingTradeRequestStateOnly();
                return;
            }

            try {
                const raw = window.localStorage.getItem(TRADE_REQUEST_STORAGE_KEY);
                if (!raw) {
                    clearIncomingTradeRequestStateOnly();
                    return;
                }

                const parsed = JSON.parse(raw);
                const storedForUser = String(parsed?.forUserName || '').trim();
                const fromUserName = String(parsed?.fromUserName || '').trim();
                const fromUserLabel = String(parsed?.fromUserLabel || fromUserName || '').trim();

                if (!storedForUser || storedForUser !== userName || !fromUserName) {
                    clearIncomingTradeRequestStateOnly();
                    return;
                }

                setIncomingTradeRequest({
                    fromUserName,
                    fromUserLabel: fromUserLabel || fromUserName,
                });
            } catch {
                clearIncomingTradeRequestStateOnly();
            }
        }, [userName, clearIncomingTradeRequestStateOnly]);

        const restoreDismissedTradeNoticeForUser = React.useCallback(() => {
            if (!userName) {
                clearDismissedTradeNoticeStateOnly();
                return;
            }

            try {
                const raw = window.localStorage.getItem(TRADE_REQUEST_DISMISS_STORAGE_KEY);
                if (!raw) {
                    clearDismissedTradeNoticeStateOnly();
                    return;
                }

                const parsed = JSON.parse(raw);
                const storedForUser = String(parsed?.forUserName || '').trim();
                const fromUserName = String(parsed?.fromUserName || '').trim();

                if (!storedForUser || storedForUser !== userName || !fromUserName) {
                    clearDismissedTradeNoticeStateOnly();
                    return;
                }

                setDismissedTradeFromUserName(fromUserName);
            } catch {
                clearDismissedTradeNoticeStateOnly();
            }
        }, [userName, clearDismissedTradeNoticeStateOnly]);

        const refreshIncomingTradeRequest = React.useCallback(async () => {
            if (!userName) {
                clearIncomingTradeRequestStateOnly();
                clearDismissedTradeNoticeStateOnly();
                return;
            }

                const pendingTrade = await gameApiClient.loadPendingTrade();
            if (!pendingTrade?.otherUserName) {
                clearIncomingTradeRequest();
                return;
            }

            setIncomingTradeRequest((prev) => {
                if (!prev.fromUserName) {
                    return prev;
                }

                if (prev.fromUserName !== pendingTrade.otherUserName) {
                    return {
                        fromUserName: pendingTrade.otherUserName,
                        fromUserLabel: pendingTrade.otherUserLabel || pendingTrade.otherUserName,
                    };
                }

                return prev;
            });
        }, [userName, clearIncomingTradeRequest, clearIncomingTradeRequestStateOnly, clearDismissedTradeNoticeStateOnly]);

    const restoreTradedCardsOnLogout = async (activeUserName) => {
        if (!activeUserName) return;

        const selectedTradeCards = await gameApiClient.loadSelectedTradeCards();
        if (!Array.isArray(selectedTradeCards) || selectedTradeCards.length === 0) {
            return;
        }

        await gameApiClient.cancelTrade(selectedTradeCards);
    };

    const logout = async () => {
        const logoutUserName = userName;
        await restoreTradedCardsOnLogout(logoutUserName);
        await logoutAuth();
    tradeRealtimeClient.disconnect();
    setAuthState(AuthState.Unauthenticated);
    setUserName('');
    setProfile({ username: '', admin: false, wallet: 0 });
    clearIncomingTradeRequestStateOnly();
        clearDismissedTradeNoticeStateOnly();
    navigate('/');
  };

    const refreshProfile = React.useCallback(async () => {
        if (!userName) {
            setProfile({ username: '', admin: false, wallet: 0 });
            return;
        }

        const nextProfile = await getProfile();
        if (!nextProfile) {
            setProfile({ username: userName, admin: false, wallet: 0 });
            return;
        }

        setProfile({
            username: nextProfile.username || userName,
            admin: Boolean(nextProfile.admin),
            wallet: Number.isFinite(Number(nextProfile.wallet)) ? Number(nextProfile.wallet) : 0,
        });
    }, [userName]);

    React.useEffect(() => {
        (async () => {
            const user = await getMe();
            setUserName(user?.username || '');
            setAuthState(user?.username ? AuthState.Authenticated : AuthState.Unauthenticated);
        })();
    }, []);

    React.useEffect(() => {
        if (authState !== AuthState.Authenticated || !userName) {
            return;
        }

        (async () => {
            await refreshProfile();
            await gameApiClient.syncCardCatalog();
            await gameApiClient.loadCardValues();
        })();
    }, [authState, userName, refreshProfile]);

    React.useEffect(() => {
        if (authState !== AuthState.Authenticated || !userName) {
            tradeRealtimeClient.disconnect();
            clearIncomingTradeRequestStateOnly();
            clearDismissedTradeNoticeStateOnly();
            return;
        }

        tradeRealtimeClient.connect(userName);
        restoreIncomingTradeRequestForUser();
        restoreDismissedTradeNoticeForUser();
        refreshIncomingTradeRequest();

        const unsubscribe = tradeRealtimeClient.subscribe((event) => {
            if (!event || event.channel !== 'trade') return;

            if (event.type === 'trade_request_received') {
                const fromUserName = String(event.fromUserName || '').trim();
                const fromUserLabel = String(event.fromUserLabel || fromUserName || '').trim();
                if (!fromUserName) return;

                setIncomingTradeRequestAndPersist({
                    fromUserName,
                    fromUserLabel: fromUserLabel || fromUserName,
                });
                // New request should be visible even if an older one was dismissed.
                setDismissedTradeNoticeAndPersist('');
                return;
            }

            if (event.type === 'trade_cancelled' || event.type === 'trade_completed') {
                clearIncomingTradeRequest();
                return;
            }

            if (event.type === 'trade_state_updated') {
                refreshIncomingTradeRequest();
            }
        });

        return () => {
            unsubscribe();
        };
    }, [
        authState,
        userName,
        clearIncomingTradeRequest,
        clearIncomingTradeRequestStateOnly,
        clearDismissedTradeNoticeStateOnly,
        refreshIncomingTradeRequest,
        restoreDismissedTradeNoticeForUser,
        restoreIncomingTradeRequestForUser,
        setDismissedTradeNoticeAndPersist,
        setIncomingTradeRequestAndPersist,
    ]);

    const incomingTradeLabel = incomingTradeRequest.fromUserLabel || incomingTradeRequest.fromUserName;
    const hasIncomingTradeRequest = Boolean(incomingTradeRequest.fromUserName);
    const isIncomingTradeDismissed =
        hasIncomingTradeRequest && dismissedTradeFromUserName === incomingTradeRequest.fromUserName;

    const handleOpenTradeFromBanner = async () => {
        if (!userName || !incomingTradeRequest.fromUserName) {
            navigate('/trades');
            return;
        }

        // Opening the trade should hide this banner locally.
        setDismissedTradeNoticeAndPersist(incomingTradeRequest.fromUserName);

        // Align local pending trade metadata without sending a new trade request event.
        await gameApiClient.savePendingTrade({
            otherUserName: incomingTradeRequest.fromUserName,
            otherUserLabel: incomingTradeRequest.fromUserLabel || incomingTradeRequest.fromUserName,
            otherTradeCards: [],
        });
        navigate('/trades');
    };

  return (
    <div className="body bg-dark text-light">
        <header>
                <h1>Fjord</h1>

                <nav>
                    <menu>
                    <li><NavLink to="/">Home</NavLink></li>

                    {authState === AuthState.Authenticated && (
                        <li><NavLink to="/packs">Open Card Packs</NavLink></li>
                    )}
                    
                    {authState === AuthState.Authenticated && (
                        <li><NavLink to="/trades">Trade</NavLink></li>
                    )}
                    
                    {authState === AuthState.Authenticated && (
                        <li><NavLink to="/designer">Design Cards</NavLink></li>
                    )}

                    {authState === AuthState.Authenticated && (
                        <li><NavLink to="/bank">Bank</NavLink></li>
                    )}

                    {authState === AuthState.Authenticated && (
                        <li><NavLink to="/leaderboard">Leaderboard</NavLink></li>
                    )}

                    {authState === AuthState.Authenticated && isAdminUser && (
                        <li><NavLink to="/approve">Approve</NavLink></li>
                    )}

                    {authState === AuthState.Authenticated && isAdminUser && (
                        <li><NavLink to="/admin-cards">Card Catalog</NavLink></li>
                    )}

                    {authState === AuthState.Authenticated && (
                        <li><button className="nav-link btn btn-link text-light p-0" onClick={logout}>Logout</button></li>
                    )}
                    </menu>
                </nav>
                
            </header>

            {authState === AuthState.Authenticated && hasIncomingTradeRequest && !isIncomingTradeDismissed && (
                <div className="global-trade-notice" role="status" aria-live="polite">
                    <span>{incomingTradeLabel} wants to trade with you</span>
                    <div className="global-trade-notice-actions">
                        <button
                            type="button"
                            className="global-trade-notice-action"
                            onClick={handleOpenTradeFromBanner}
                        >
                            Open Trade
                        </button>
                        <button
                            type="button"
                            className="global-trade-notice-dismiss"
                            onClick={() => setDismissedTradeNoticeAndPersist(incomingTradeRequest.fromUserName)}
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            )}

            <Routes>
                <Route path='/' element={<Login 
                
                    userName={userName}
                    authState={authState}
                    onAuthChange={async (userName, authState) => {
                    setAuthState(authState);
                    setUserName(userName);
                    }}

                />} exact />
                <Route path='/deck' element={<Deck userName={userName} />} />
                                <Route path='/designer' element={<Designer userName={userName} />} />
                <Route path='/trades' element={<Trades userName={userName} />} />
                <Route path='/packs' element={<Packs userName={userName} />} />
                <Route path='/bank' element={<Bank userName={userName} />} />
                <Route path='/leaderboard' element={authState === AuthState.Authenticated ? <Leaderboard userName={userName} /> : <Navigate to='/' replace />} />
                <Route path='/approve' element={isAdminUser ? <Approve userName={userName} /> : <Navigate to='/' replace />} />
                <Route path='/admin-cards' element={isAdminUser ? <AdminCards /> : <Navigate to='/' replace />} />
                <Route path='*' element={<NotFound />} />
            </Routes>

            <footer>
                <span className="text-reset">Josh Brown</span>
                <br />
                <NavLink to="https://github.com/TheJoosh/fjord">GitHub</NavLink>
            </footer>
    </div>
  );
}

function NotFound() {
  return <main className="container-fluid bg-secondary text-center">404: manan kanchu.</main>;
}