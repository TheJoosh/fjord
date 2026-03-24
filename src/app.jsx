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
import { Approve } from './approve/approve';
import { AdminCards } from './adminCards/adminCards';
import { getMe, getProfile, logoutAuth } from './login/authService';
import { gameApiClient } from '../service/gameApiClient';
import { tradeRealtimeClient } from '../service/tradeRealtimeClient';

export default function App() {

        const [userName, setUserName] = React.useState('');
    const [authState, setAuthState] = React.useState(AuthState.Unknown);
    const [profile, setProfile] = React.useState({ username: '', admin: false, wallet: 0 });
        const [incomingTradeRequest, setIncomingTradeRequest] = React.useState({ fromUserName: '', fromUserLabel: '' });
    const isAdminUser = Boolean(profile?.admin);
  const navigate = useNavigate();

        const clearIncomingTradeRequest = React.useCallback(() => {
            setIncomingTradeRequest({ fromUserName: '', fromUserLabel: '' });
        }, []);

        const refreshIncomingTradeRequest = React.useCallback(async () => {
            if (!userName) {
                clearIncomingTradeRequest();
                return;
            }

            const pendingTrade = await gameApiClient.loadPendingTrade(userName);
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
        }, [userName, clearIncomingTradeRequest]);

    const restoreTradedCardsOnLogout = async (activeUserName) => {
        if (!activeUserName) return;

        const selectedTradeCards = await gameApiClient.loadSelectedTradeCards(activeUserName);
        if (!Array.isArray(selectedTradeCards) || selectedTradeCards.length === 0) {
            return;
        }

        await gameApiClient.cancelTrade(activeUserName, selectedTradeCards);
    };

    const logout = async () => {
        const logoutUserName = userName;
        await restoreTradedCardsOnLogout(logoutUserName);
        await logoutAuth();
    tradeRealtimeClient.disconnect();
    setAuthState(AuthState.Unauthenticated);
    setUserName('');
    setProfile({ username: '', admin: false, wallet: 0 });
    clearIncomingTradeRequest();
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
            clearIncomingTradeRequest();
            return;
        }

        tradeRealtimeClient.connect(userName);
        refreshIncomingTradeRequest();

        const unsubscribe = tradeRealtimeClient.subscribe((event) => {
            if (!event || event.channel !== 'trade') return;

            if (event.type === 'trade_request_received') {
                const fromUserName = String(event.fromUserName || '').trim();
                const fromUserLabel = String(event.fromUserLabel || fromUserName || '').trim();
                if (!fromUserName) return;

                setIncomingTradeRequest({
                    fromUserName,
                    fromUserLabel: fromUserLabel || fromUserName,
                });
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
    }, [authState, userName, clearIncomingTradeRequest, refreshIncomingTradeRequest]);

    const incomingTradeLabel = incomingTradeRequest.fromUserLabel || incomingTradeRequest.fromUserName;
    const hasIncomingTradeRequest = Boolean(incomingTradeRequest.fromUserName);

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

            {authState === AuthState.Authenticated && hasIncomingTradeRequest && (
                <div className="global-trade-notice" role="status" aria-live="polite">
                    <span>{incomingTradeLabel} wants to trade with you</span>
                    <button
                        type="button"
                        className="global-trade-notice-action"
                        onClick={() => navigate('/trades')}
                    >
                        Open Trade
                    </button>
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