import React from 'react';

export function Login() {
  return (
    <main>
        <div className="column login">
            <div>
                <img className="logo"width="30px" src="fehu-symbol-icon.png" alt="Fehu, a runic letter F"/>
            </div>
            <h1>FJORD</h1>

            <div className="spacer">
                <span>Welcome to the Fjords. Begin your voyage today!</span>
            </div>

            <form className="login-form" method="get" action="deck.html">
                <div>
                    <span>Email</span>
                    <input type="text" placeholder="your@email.com" />
                </div>
                <div>
                    <span>Password</span>
                    <input type="password" placeholder="password" />
                </div>
                <button type="submit">Log in</button>
                <button type="submit">Create account</button>
            </form>
        </div>
        <div className="header-image">
            <img src="Card Images/longboat.png" alt="A longboat floating on the fjord" object-fit="cover" />
        </div>
    </main>

        
  );
}