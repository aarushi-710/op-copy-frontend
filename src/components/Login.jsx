import axios from 'axios';
import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import logo from '../assets/Padget.jpeg';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [line, setLine] = useState('line1');
  const [error, setError] = useState(null);
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('https://op-copy-backend.onrender.com/api/auth/login', {
        username,
        password,
        line,
      });
      login(response.data.token, response.data.line);
      localStorage.setItem('token', response.data.token);
      navigate(`/${line}`);
    } catch (error) {
      if (error.response && error.response.data.message) {
        setError(error.response.data.message);
      } else {
        setError('Server Error');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-100 via-white to-gray-100 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md transform transition-all hover:scale-105 duration-300">
        <div className="flex justify-center mb-6">
          <img src={logo} alt="CheckSheets Logo" className="h-12 w-auto" />
        </div>
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">Welcome Back</h2>
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-center">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              type="text"
              id="username"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              id="password"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="line" className="block text-sm font-medium text-gray-700 mb-1">
              Production Line
            </label>
            <select
              id="line"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition"
              value={line}
              onChange={(e) => setLine(e.target.value)}
            >
              <option value="line1">Line 1</option>
              <option value="line2">Line 2</option>
              <option value="line3">Line 3</option>
            </select>
          </div>
          <div className="flex items-center justify-between">
            <label className="inline-flex items-center">
              <input
                type="checkbox"
                className="form-checkbox h-4 w-4 text-purple-600 transition"
              />
              <span className="ml-2 text-sm text-gray-600">Remember me</span>
            </label>
            <a
              href="#"
              className="text-sm text-purple-600 hover:text-purple-800 transition"
            >
              Forgot Password?
            </a>
          </div>
          <button
            type="submit"
            className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 focus:ring-4 focus:ring-purple-300 transition font-medium"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;