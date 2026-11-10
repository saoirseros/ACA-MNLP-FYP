import React, { useContext, useEffect, useState } from 'react'
import assets from '../assets/assets'
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { ChatContext } from '../../context/ChatContext';
import AlgorithmShowcase from './AlgorithmShowcase';

const Sidebar = () => {

    const {getUsers, users, selectedUser, setSelectedUser,
        unseenMessages, setUnseenMessages } = useContext(ChatContext);

    const {logout, onlineUsers} = useContext(AuthContext)

    const [input, setInput] = useState(false)
    const [showAlgorithmShowcase, setShowAlgorithmShowcase] = useState(false)

    const navigate = useNavigate();

    const filteredUsers = input ? users.filter((user)=>user.fullName.toLowerCase().includes(input.toLowerCase())) : users;

    useEffect(()=>{
        getUsers();
    },[onlineUsers])

  return (
    <div className={`bg-black/60 border-r border-aca-border h-full p-5 overflow-y-scroll text-white ${selectedUser ? "max-md:hidden" : ''}`}>
      <div className='pb-5'>
        <div className='flex justify-between items-center'>
            <div className='flex items-center gap-2'>
                <img src={assets.logo_icon} alt="ACA Chat logo" className='w-8' />
                <span className='text-xl font-semibold tracking-wide'>ACA <span className='text-aca-red-bright'>Chat</span></span>
            </div>
            <div className="relative py-2 group">
                <img src={assets.menu_icon} alt="Menu" className='max-h-5 cursor-pointer' />
                <div className='absolute top-full right-0 z-20 w-32 p-5 rounded-md bg-aca-surface-2 border border-aca-border text-gray-100 hidden group-hover:block'>
                    <p onClick={()=>navigate('/profile')} className='cursor-pointer text-sm hover:text-aca-red-bright'>Edit Profile</p>
                    <hr className="my-2 border-t border-aca-border" />
                    <p onClick={()=> logout()} className='cursor-pointer text-sm hover:text-aca-red-bright'>Logout</p>
                </div>
            </div>
        </div>

        <div className='bg-aca-surface-2 border border-aca-border rounded-full flex items-center gap-2 py-3 px-4 mt-5 focus-within:border-aca-red'>
            <img src={assets.search_icon} alt="Search" className='w-3'/>
            <input onChange={(e)=>setInput(e.target.value)} type="text" className='bg-transparent border-none outline-none text-white text-xs placeholder-[#8a8a90] flex-1' placeholder='Search User...'/>
        </div>

        {/* Entry point for the Algorithm Showcase: visualizes how Adaptive
            Context Activation decides how much history each message needs,
            with real example workflows. */}
        <button
            onClick={()=> setShowAlgorithmShowcase(true)}
            className='w-full mt-3 flex items-center justify-center gap-2 bg-aca-surface-2 border border-aca-border hover:border-aca-red hover:bg-aca-red/10 rounded-full py-2.5 text-xs transition'
        >
            🧭 Algorithm Showcase
        </button>

      </div>

    <div className='flex flex-col'>
        {filteredUsers.map((user, index)=>(
            <div onClick={()=> {setSelectedUser(user); setUnseenMessages(prev=> ({...prev, [user._id]:0}))}}
             key={index} className={`relative flex items-center gap-2 p-2 pl-4 rounded cursor-pointer max-sm:text-sm hover:bg-white/5 ${selectedUser?._id === user._id && 'bg-aca-red/15 border-l-2 border-aca-red'}`}>
                <img src={user?.profilePic || assets.avatar_icon} alt="" className='w-[35px] aspect-[1/1] rounded-full'/>
                <div className='flex flex-col leading-5'>
                    <p>{user.fullName}</p>
                    {
                        onlineUsers.includes(user._id)
                        ? <span className='text-green-400 text-xs'>Online</span>
                        : <span className='text-neutral-400 text-xs'>Offline</span>
                    }
                </div>
                {unseenMessages[user._id] > 0 && <p className='absolute top-4 right-4 text-xs h-5 w-5 flex justify-center items-center rounded-full bg-aca-red'>{unseenMessages[user._id]}</p>}
            </div>
        ) )}
    </div>

    {showAlgorithmShowcase && <AlgorithmShowcase onClose={()=> setShowAlgorithmShowcase(false)} />}

    </div>
  )
}

export default Sidebar
