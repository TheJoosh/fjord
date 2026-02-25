import React from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import './app.css';
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import { Login } from './login/login';
import { AuthState } from './login/authState';
import { Deck } from './deck/deck';
import { Designer } from './designer/designer';
import { Packs } from './packs/packs';
import { Trades } from './trades/trades';

export default function App() {

  const [userName, setUserName] = React.useState(localStorage.getItem('userName') || '');
  const currentAuthState = userName ? AuthState.Authenticated : AuthState.Unauthenticated;
  const [authState, setAuthState] = React.useState(currentAuthState);

  return (
    <BrowserRouter>
  
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

                    }}

                />} exact />
                <Route path='/deck' element={<Deck />} />
                <Route path='/designer' element={<Designer />} />
                <Route path='/trades' element={<Trades />} />
                <Route path='/packs' element={<Packs />} />
                <Route path='*' element={<NotFound />} />
            </Routes>

            <footer>
                <span className="text-reset">Josh Brown</span>
                <br />
                <NavLink to="https://github.com/TheJoosh/fjord">GitHub</NavLink>
            </footer>
    </div>;

    </BrowserRouter>
);
}

function NotFound() {
  return <main className="container-fluid bg-secondary text-center">404: manan kanchu.</main>;
}