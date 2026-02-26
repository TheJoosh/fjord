import React from 'react';
import { getUser } from '../data/users';

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
    // new users are currently defined in src/data/users.js; account creation
    // is not supported in this mock environment.
    setMessage('Account creation is disabled.');
  };

  return (
    <main>
      <div className="column login">
        <h2>Welcome to the Fjords! Begin your voyage today.</h2>
        <form className="login-form" onSubmit={handleSubmit}>
          <div>
            <span>Username</span>
            <input
              type="text"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="username or email"
            />
          </div>
          <div>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="password"
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