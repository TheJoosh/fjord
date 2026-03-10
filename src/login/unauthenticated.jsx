import React from 'react';
import { getUser, users } from '../data/users';
import { storageService } from '../../services/storageService';

// component used when the user is not signed in
export function Unauthenticated({ userName, onLogin }) {
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [message, setMessage] = React.useState('');

  // when checking credentials, consult the mock user database
  const handleSubmit = async e => {
    e.preventDefault();
    if (!username || !password) {
      setMessage('Please enter both username and password.');
      return;
    }
    const user = getUser(username);
    if (user && user.password === password) {
      setMessage('');
      // Keep existing behavior: local login remains authoritative.
      void createAuth('PUT', username, password);
      onLogin(username);
    } else {
      setMessage('Invalid credentials');
    }
  };

  const handleCreateAccount = async () => {
    const loginName = username.trim();
    if (!loginName || !password) {
      setMessage('Please enter both username and password.');
      return;
    }

    if (getUser(loginName)) {
      setMessage('Username already exists.');
      return;
    }

    const newUser = {
      password,
      wallet: 0,
      admin: false,
      cards: {},
      packs: {
        'Default Pack': 1,
        'Saga Pack': 0,
        'Heroic Pack': 0,
        'Mythbound Pack': 0,
      },
      designed: 0,
    };

    users[loginName] = newUser;

    const usersMap = await storageService.getUsersMap();
    usersMap[loginName] = newUser;
    await storageService.setUsersMap(usersMap);

    const packsMap = await storageService.getUsersPacksMap();
    packsMap[loginName] = { ...newUser.packs };
    await storageService.setUsersPacksMap(packsMap);

    // Keep existing behavior: local account creation remains authoritative.
    void createAuth('POST', loginName, password);
    setMessage('Account created. Logging in...');
    onLogin(loginName);
  };

  async function createAuth(method, loginName, loginPassword) {
    try {
      const res = await fetch('/api/auth', {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        username: loginName,
        email: loginName,
        password: loginPassword,
      }),
    });

      // Consume response when present so callers can extend this later.
      await res.json().catch(() => null);
      return res.ok;
    } catch {
      return false;
    }
  }

  return (
    <main>
      <div className="column login">
        <h2>Welcome to the Fjords! Begin your voyage today.</h2>
        <form className="login-form" onSubmit={handleSubmit}>
          <div>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="username"
              id="username"
              autoComplete="username"
            />
          </div>
          <div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="password"
              id="password"
              autoComplete="current-password"
            />
          </div>
          <button type="submit">Log in</button>
          <button type="button" onClick={handleCreateAccount}>
            Create account
          </button>
          {message && <p className="login-message">{message}</p>}
        </form>
      </div>
        <div className="header-image">
            <img src="Card Images/longboat.png" alt="A longboat floating on the fjord" object-fit="cover" />
        </div>
    </main>

        
  );
}