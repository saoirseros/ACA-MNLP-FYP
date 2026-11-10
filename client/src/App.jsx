import React, { useContext } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import ProfilePage from './pages/ProfilePage'
import {Toaster} from "react-hot-toast"
import { AuthContext } from '../context/AuthContext'
import assets from './assets/assets'

const App = () => {
  const { authUser } = useContext(AuthContext)
  return (
    <div className="relative min-h-screen bg-aca-bg text-white">
      <div
        aria-hidden="true"
        className="fixed inset-0 z-0 bg-cover bg-center pointer-events-none"
        style={{ backgroundImage: `url("${assets.bgStreaks}")` }}
      />
      <div className="relative z-10">
        <Toaster toastOptions={{ style: { background: '#170a0c', color: '#fff', border: '1px solid #3a1218' } }}/>
        <Routes>
          <Route path='/' element={authUser ? <HomePage /> : <Navigate to="/login" />}/>
          <Route path='/login' element={!authUser ? <LoginPage /> : <Navigate to="/" />}/>
          <Route path='/profile' element={authUser ? <ProfilePage /> : <Navigate to="/login" />}/>
        </Routes>
      </div>
    </div>
  )
}

export default App
