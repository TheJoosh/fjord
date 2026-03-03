import React from 'react';
import { getUser, users } from '../data/users';

// component used when the user is not signed in
export function Unauthenticated({ userName, onLogin }) {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [message, setMessage] = React.useState('');

  // when checking credentials, consult the mock user database
  const handleSubmit = e => {
    e.preventDefault();
    if (!email || !password) {
      setMessage('Please enter both username and password.');
      return;
    }
    const user = getUser(email);
    if (user && user.password === password) {
      setMessage('');
      onLogin(email);
    } else {
      setMessage('Invalid credentials');
    }
  };

  const handleCreateAccount = () => {
    const loginName = email.trim();
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

    let usersMap = {};
    try {
      const rawUsersMap = localStorage.getItem('users');
      usersMap = rawUsersMap ? JSON.parse(rawUsersMap) : {};
    } catch {
      usersMap = {};
    }
    usersMap[loginName] = newUser;
    localStorage.setItem('users', JSON.stringify(usersMap));

    let packsMap = {};
    try {
      const rawPacksMap = localStorage.getItem('usersPacks');
      packsMap = rawPacksMap ? JSON.parse(rawPacksMap) : {};
    } catch {
      packsMap = {};
    }
    packsMap[loginName] = { ...newUser.packs };
    localStorage.setItem('usersPacks', JSON.stringify(packsMap));

    setMessage('Account created. Logging in...');
    onLogin(loginName);
  };

  return (
    <main>
      <div className="column login">
        <h2>Welcome to the Fjords! Begin your voyage today.</h2>
        <form className="login-form" onSubmit={handleSubmit}>
          <div>
            <input
              type="text"
              value={email}
              onChange={e => setEmail(e.target.value)}
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