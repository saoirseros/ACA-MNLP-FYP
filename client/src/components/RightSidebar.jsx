import React, { useContext, useEffect, useState } from 'react'
import assets, { imagesDummyData } from '../assets/assets'
import { ChatContext } from '../../context/ChatContext'
import { AuthContext } from '../../context/AuthContext'
import AnalyticsDashboard from './AnalyticsDashboard'

const RightSidebar = () => {

    const {selectedUser, messages} = useContext(ChatContext)
    const {logout, onlineUsers} = useContext(AuthContext)
    const [msgImages, setMsgImages] = useState([])
    const [activeTab, setActiveTab] = useState('media')
    const [activeTabUserId, setActiveTabUserId] = useState(selectedUser?._id)

    // Get all the images from the messages and set them to state
    useEffect(()=>{
        setMsgImages(
            messages.filter(msg => msg.image).map(msg=>msg.image)
        )
    },[messages])

    // Reset to the Media tab whenever the conversation changes, so a
    // previous conversation's Dashboard tab isn't left open by accident.
    // Adjusted during render (not an effect) to avoid an extra cascading
    // render, per React's "adjusting state when props change" pattern.
    if (selectedUser?._id !== activeTabUserId) {
        setActiveTabUserId(selectedUser?._id)
        setActiveTab('media')
    }

  return selectedUser && (
    <div className={`bg-[#8185B2]/10 text-white w-full relative overflow-y-scroll ${selectedUser ? "max-md:hidden" : ""}`}>

        <div className='pt-16 flex flex-col items-center gap-2 text-xs font-light mx-auto'>
            <img src={selectedUser?.profilePic || assets.avatar_icon} alt=""
            className='w-20 aspect-[1/1] rounded-full' />
            <h1 className='px-10 text-xl font-medium mx-auto flex items-center gap-2'>
                {onlineUsers.includes(selectedUser._id) && <p className='w-2 h-2 rounded-full bg-green-500'></p>}
                {selectedUser.fullName}
            </h1>
            <p className='px-10 mx-auto'>{selectedUser.bio}</p>
        </div>

        <hr className="border-[#ffffff50] my-4"/>

        {/* Media / Dashboard tab switcher - the Dashboard tab shows the
            real, live analytics of every NLP module run on this
            conversation (sentiment, emotion, toxicity, topic, summary,
            model routing), not just the media grid. */}
        <div className='px-5 flex gap-2 text-xs mb-2'>
            <button
                onClick={()=> setActiveTab('media')}
                className={`flex-1 py-1.5 rounded-full transition ${activeTab === 'media' ? 'bg-violet-500/40 text-white' : 'bg-white/5 text-gray-400'}`}
            >
                Media
            </button>
            <button
                onClick={()=> setActiveTab('dashboard')}
                className={`flex-1 py-1.5 rounded-full transition ${activeTab === 'dashboard' ? 'bg-violet-500/40 text-white' : 'bg-white/5 text-gray-400'}`}
            >
                📊 Dashboard
            </button>
        </div>

        {activeTab === 'media' && (
            <div className="px-5 text-xs pb-24">
                <p>Media</p>
                <div className='mt-2 max-h-[200px] overflow-y-scroll grid grid-cols-2 gap-4 opacity-80'>
                    {msgImages.map((url, index)=>(
                        <div key={index} onClick={()=> window.open(url)} className='cursor-pointer rounded'>
                            <img src={url} alt="" className='h-full rounded-md'/>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {activeTab === 'dashboard' && (
            <AnalyticsDashboard key={selectedUser._id} />
        )}

        {/* In normal document flow (not absolutely positioned) so it scrolls
            away with the rest of the sidebar content instead of staying
            pinned on top of the Media/Dashboard panels. */}
        <div className='flex justify-center py-5'>
            <button onClick={()=> logout()} className='bg-gradient-to-r from-purple-400 to-violet-600 text-white border-none text-sm font-light py-2 px-20 rounded-full cursor-pointer'>
                Logout
            </button>
        </div>
    </div>
  )
}

export default RightSidebar
