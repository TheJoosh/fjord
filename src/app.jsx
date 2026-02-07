import React from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import './app.css';

export default function App() {
  return <div className="body bg-dark text-light">
    <header>
            <h1>Fjord</h1>

            <nav>
                <menu>
                <li><a href="index.html">Home</a></li>
                <li><a href="packs.html">Open Card Packs</a></li>
                <li><a href="deck.html">View Deck</a></li>
                <li><a href="trades.html">Trade</a></li>
                <li><a href="designer.html">Design Cards</a></li>
                </menu>
            </nav>
            
        </header>

        <main>App components</main>

        <footer>
            <span class="text-reset">Josh Brown</span>
            <br />
            <a href="https://github.com/TheJoosh/fjord">GitHub</a>
        </footer>
  </div>;
}