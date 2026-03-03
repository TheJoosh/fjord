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
import { getUser, users } from './data/users';
import { getCardByName, recalcCardValues, syncCardPopulationsFromOwnedCards } from './data/cards';
import { storageService } from './services/storageService';

export default function App() {

    React.useEffect(() => {
        syncCardPopulationsFromOwnedCards(users);
        recalcCardValues();
    }, []);

    const [userName, setUserName] = React.useState(storageService.getCurrentUserName() || '');
  const currentAuthState = userName ? AuthState.Authenticated : AuthState.Unauthenticated;
  const [authState, setAuthState] = React.useState(currentAuthState);
    const activeUser = getUser(userName);
    const isAdminUser = Boolean(activeUser?.admin);
  const navigate = useNavigate();

    const restoreTradedCardsOnLogout = (activeUserName) => {
        if (!activeUserName) return;

        const tradeSelectionStorageKey = `tradeSelection:${activeUserName}`;
        let selectedTradeCards = storageService.getJson(tradeSelectionStorageKey, []);
        selectedTradeCards = Array.isArray(selectedTradeCards) ? selectedTradeCards : [];

        if (!selectedTradeCards.length) {
            storageService.remove(tradeSelectionStorageKey);
            return;
        }

        const restoreCounts = new Map();
        for (const card of selectedTradeCards) {
            if (!card?.name) continue;
            restoreCounts.set(card.name, (restoreCounts.get(card.name) || 0) + 1);
        }

        const user = getUser(activeUserName);
        if (user) {
            user.cards = user.cards || {};
            for (const [name, qty] of restoreCounts.entries()) {
                user.cards[name] = (parseInt(user.cards[name], 10) || 0) + qty;
            }

            const nextOwned = Object.entries(user.cards)
                .map(([name, qty]) => ({
                    name,
                    qty: Math.max(0, parseInt(qty, 10) || 0),
                    card: getCardByName(name),
                }))
                .filter(entry => entry.qty > 0);

            storageService.setOwnedCards(activeUserName, nextOwned);
        }

        storageService.remove(tradeSelectionStorageKey);
    };

  const logout = () => {
        const logoutUserName = userName;
        restoreTradedCardsOnLogout(logoutUserName);
    setAuthState(AuthState.Unauthenticated);
    setUserName('');
        storageService.setCurrentUserName('');
    navigate('/');
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

                    {authState === AuthState.Authenticated && isAdminUser && (
                        <li><NavLink to="/approve">Approve</NavLink></li>
                    )}

                    {authState === AuthState.Authenticated && (
                        <li><button className="nav-link btn btn-link text-light p-0" onClick={logout}>Logout</button></li>
                    )}
                    </menu>
                </nav>
                
            </header>

            <Routes>
                <Route path='/' element={<Login 
                
                    userName={userName}
                    authState={authState}
                    onAuthChange={(userName, authState) => {
                    setAuthState(authState);
                    setUserName(userName);

                                        if (authState === AuthState.Authenticated && userName) {
                                            storageService.setCurrentUserName(userName);
                                        } else {
                                            storageService.setCurrentUserName('');
                                        }

                    }}

                />} exact />
                <Route path='/deck' element={<Deck userName={userName} />} />
                                <Route path='/designer' element={<Designer userName={userName} />} />
                <Route path='/trades' element={<Trades userName={userName} />} />
                <Route path='/packs' element={<Packs userName={userName} />} />
                <Route path='/bank' element={<Bank userName={userName} />} />
                <Route path='/approve' element={isAdminUser ? <Approve userName={userName} /> : <Navigate to='/' replace />} />
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