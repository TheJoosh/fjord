import React from 'react';
import { loginAuth, registerAuth } from './authService';

// component used when the user is not signed in
export function Unauthenticated({ userName, onLogin }) {
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [message, setMessage] = React.useState('');

  const handleSubmit = async e => {
    e.preventDefault();
    const loginName = username.trim();

    if (!loginName || !password) {
      setMessage('Please enter both username and password.');
      return;
    }

    const user = await loginAuth(loginName, password);
    if (user?.username) {
      setMessage('');
      onLogin(user.username);
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

    const user = await registerAuth(loginName, password);
    if (user?.username) {
      setMessage('Account created. Logging in...');
      onLogin(user.username);
      return;
    }

    setMessage('Unable to create account. Username may already exist.');
  };

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