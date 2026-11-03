import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AddressProvider } from './address/AddressContext.jsx';
import { AuthProvider } from './auth/AuthContext.jsx';
import { CartProvider } from './cart/CartContext.jsx';
import { CartDrawerProvider } from './cart/CartDrawer.jsx';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AddressProvider>
          <CartProvider>
            <CartDrawerProvider>
              <App />
            </CartDrawerProvider>
          </CartProvider>
        </AddressProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);