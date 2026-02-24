import React from 'react';

// component used when the user is not signed in
export function Unauthenticated() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');

  const handleSubmit = e => {
    e.preventDefault();
    // TODO: validate creds / call API...
    onLogin(email);
  };

  return (
    <main>
      <div className="column login">
        …{/* logo/headings omitted for brevity */}
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
          <button type="button" onClick={() => {}}>
            Create account
          </button>
        </form>
      </div>
        <div className="header-image">
            <img src="Card Images/longboat.png" alt="A longboat floating on the fjord" object-fit="cover" />
        </div>
    </main>

        
  );
}