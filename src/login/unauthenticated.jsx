import React from 'react';

// component used when the user is not signed in
export function Unauthenticated({ userName, onLogin }) {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [message, setMessage] = React.useState('');

  // load users from localStorage
  const loadUsers = () => {
    try {
      return JSON.parse(localStorage.getItem('users')) || {};
    } catch {
      return {};
    }
  };

  const saveUsers = users => {
    localStorage.setItem('users', JSON.stringify(users));
  };

  const handleSubmit = e => {
    e.preventDefault();
    const users = loadUsers();
    if (!email || !password) {
      setMessage('Please enter both username and password.');
      return;
    }
    if (users[email] && users[email] === password) {
      setMessage('');
      onLogin(email);
    } else {
      setMessage('Invalid credentials');
    }
  };

  const handleCreateAccount = () => {
    const users = loadUsers();
    if (!email || !password) {
      setMessage('Please enter both username and password.');
      return;
    }
    if (users[email]) {
      setMessage('Username already exists.');
      return;
    }
    users[email] = password;
    saveUsers(users);
    setMessage('Account created. Logging you in...');
    // reset the form
    setEmail('');
    setPassword('');
    onLogin(email);
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