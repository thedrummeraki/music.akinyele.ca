import React, { useEffect, useState } from 'react';
import logo from './logo.svg';
import './App.css';

const HOST = 'http://localhost:5000';

function App() {
  const [message, setMessage] = useState('loading');
  const [error, setError] = useState<string|null>(null);

  useEffect(() => {
    fetch(`${HOST}/api/test`)
      .then(res => res.json())
      .then(res => setMessage(res.message))
      .catch(res => setError(res.toString()));
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          <b style={{color: 'red'}}>{error}</b>
          <code>{!error && message}</code>
        </p>
      </header>
    </div>
  );
}

export default App;
