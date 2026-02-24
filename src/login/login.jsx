import React from 'react';

import { Unauthenticated } from './unauthenticated';
import { Deck } from '../deck/deck';
import { AuthState } from './authState';

export function Login({ userName, authState, onAuthChange }) {
  return (
    <main className='container-fluid bg-secondary text-center'>
      <div>
        {authState !== AuthState.Unknown && <h1>Welcome to the Fjords</h1>}
        {authState === AuthState.Authenticated && (
          <Deck userName={userName} onLogout={() => onAuthChange(userName, AuthState.Unauthenticated)} />
        )}
        {authState === AuthState.Unauthenticated && (
          <Unauthenticated
            userName={userName}
            onLogin={loginName => onAuthChange(loginName, AuthState.Authenticated)}
          />
        )}
      </div>
    </main>
  );
}