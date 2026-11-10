import React, { useState } from 'react'
import Sidebar from '../components/Sidebar'
import ChatContainer from '../components/ChatContainer'
import RightSidebar from '../components/RightSidebar'
import { useContext } from 'react'
import { ChatContext } from '../../context/ChatContext'

const HomePage = () => {

    const {selectedUser} = useContext(ChatContext)

  return (
    <div className='w-full h-screen'>
      <div className={`overflow-hidden h-full grid grid-cols-1 relative ${selectedUser ? 'md:grid-cols-[300px_1fr_320px] xl:grid-cols-[320px_1fr_360px]' : 'md:grid-cols-[320px_1fr]'}`}>
        <Sidebar />
        <ChatContainer />
        <RightSidebar/>
      </div>
    </div>
  )
}

export default HomePage
