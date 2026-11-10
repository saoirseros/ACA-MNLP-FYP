import React, { useContext, useEffect, useRef, useState } from 'react'
import assets, { messagesDummyData } from '../assets/assets'
import { formatMessageTime } from '../lib/utils'
import { ChatContext } from '../../context/ChatContext'
import { AuthContext } from '../../context/AuthContext'
import toast from 'react-hot-toast'

const ChatContainer = () => {

    const { messages, selectedUser, setSelectedUser, sendMessage, 
        getMessages, messageAnalyses, getConversationAnalytics, nlpAvailable} = useContext(ChatContext)

    const { authUser, onlineUsers } = useContext(AuthContext)

    const scrollEnd = useRef()

    const [input, setInput] = useState('');

    // Handle sending a message
    const handleSendMessage = async (e)=>{
        e.preventDefault();
        if(input.trim() === "") return null;
        await sendMessage({text: input.trim()});
        setInput("")
    }

    // Handle sending an image
    const handleSendImage = async (e) =>{
        const file = e.target.files[0];
        if(!file || !file.type.startsWith("image/")){
            toast.error("select an image file")
            return;
        }
        const reader = new FileReader();

        reader.onloadend = async ()=>{
            await sendMessage({image: reader.result})
            e.target.value = ""
        }
        reader.readAsDataURL(file)
    }

    useEffect(()=>{
        if(selectedUser){
            getMessages(selectedUser._id)
            getConversationAnalytics(selectedUser._id)
        }
    },[selectedUser])

    useEffect(()=>{
        if(scrollEnd.current && messages){
            scrollEnd.current.scrollIntoView({ behavior: "smooth"})
        }
    },[messages])

  return selectedUser ? (
    <div className='h-full overflow-scroll relative bg-black/40'>
      {/* ------- header ------- */}
      <div className='flex items-center gap-3 py-3 mx-4 border-b border-aca-border'>
        <img src={selectedUser.profilePic || assets.avatar_icon} alt="" className="w-8 rounded-full"/>
        <p className='flex-1 text-lg text-white flex items-center gap-2'>
            {selectedUser.fullName}
            {onlineUsers.includes(selectedUser._id) && <span className="w-2 h-2 rounded-full bg-green-500"></span>}
        </p>
        <img onClick={()=> setSelectedUser(null)} src={assets.arrow_icon} alt="" className='md:hidden max-w-7'/>
        <img src={assets.help_icon} alt="" className='max-md:hidden max-w-5'/>
      </div>
      {nlpAvailable === false && (
        <div className='mx-4 mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200'>
          NLP analysis is currently unavailable. Messages will still be delivered normally.
        </div>
      )}
      {/* ------- chat area ------- */}
      <div className='flex flex-col h-[calc(100%-120px)] overflow-y-scroll p-3 pb-6'>
        {messages.map((msg, index)=>{
            const analysis = messageAnalyses[msg._id];
            return (
            <div key={index} className={`flex items-end gap-2 justify-end ${msg.senderId !== authUser._id && 'flex-row-reverse'}`}>
                {msg.image ? (
                    <img src={msg.image} alt="" className='max-w-[320px] border border-aca-border rounded-lg overflow-hidden mb-8'/>
                ):(
                    <div className={`flex flex-col mb-8 max-w-[75%] md:max-w-[60%] ${msg.senderId === authUser._id ? 'items-end' : 'items-start'}`}>
                        <p className={`px-3 py-2 md:text-sm font-light rounded-lg break-words text-white ${msg.senderId === authUser._id ? 'rounded-br-none bg-aca-red/40 border border-aca-red/40' : 'rounded-bl-none bg-white/10 border border-white/10'}`}>{msg.text}</p>
                        {analysis && (
                            <div className='flex flex-wrap gap-1 mt-1 justify-end'>
                                {analysis.sentiment && (
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${analysis.sentiment.label === 'positive' ? 'bg-green-600/40 text-green-200' : 'bg-red-600/40 text-red-200'}`}>
                                        {analysis.sentiment.label} ({Math.round(analysis.sentiment.confidence * 100)}%)
                                    </span>
                                )}
                                {analysis.emotion && (
                                    <span className='text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-gray-200'>
                                        {analysis.emotion.label}
                                    </span>
                                )}
                                {analysis.toxicity?.label === 'toxic' && (
                                    <span className='text-[10px] px-2 py-0.5 rounded-full bg-red-700/60 text-red-100'>
                                        ⚠ toxic{analysis.toxicity.category ? ` · ${analysis.toxicity.category}` : ''}
                                    </span>
                                )}
                                {analysis.contextLevel && (
                                    <span
                                        className='text-[10px] px-2 py-0.5 rounded-full bg-gray-600/40 text-gray-300'
                                        title={`Adaptive Context Activation: ${analysis.selectedContextMessages ?? 0} prior message(s) selected`}
                                    >
                                        ctx: {analysis.contextLevel}{analysis.selectedContextMessages ? ` (${analysis.selectedContextMessages})` : ''}
                                    </span>
                                )}
                                {analysis.modelTier && (
                                    <span
                                        className={`text-[10px] px-2 py-0.5 rounded-full ${analysis.modelTier === 'lightweight' ? 'bg-emerald-600/40 text-emerald-200' : 'bg-aca-red/30 text-red-200'}`}
                                        title={analysis.trace?.tierReason || `Analyzed by the ${analysis.modelTier} model`}
                                    >
                                        {analysis.modelTier === 'lightweight' ? '⚡ baseline (legacy)' : '🧠 transformer'}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                )}
                <div className="text-center text-xs">
                    <img src={msg.senderId === authUser._id ? authUser?.profilePic || assets.avatar_icon : selectedUser?.profilePic || assets.avatar_icon} alt="" className='w-7 rounded-full' />
                    <p className='text-gray-500'>{formatMessageTime(msg.createdAt)}</p>
                </div>
            </div>
            )
        })}
        <div ref={scrollEnd}></div>
      </div>

{/* ------- bottom area ------- */}
    <div className='absolute bottom-0 left-0 right-0 flex items-center gap-3 p-3'>
        <div className='flex-1 flex items-center bg-aca-surface-2 border border-aca-border focus-within:border-aca-red px-3 rounded-full'>
            <input onChange={(e)=> setInput(e.target.value)} value={input} onKeyDown={(e)=> e.key === "Enter" ? handleSendMessage(e) : null} type="text" placeholder="Send a message" 
            className='flex-1 text-sm p-3 border-none rounded-lg outline-none text-white placeholder-gray-400'/>
            <input onChange={handleSendImage} type="file" id='image' accept='image/png, image/jpeg' hidden/>
            <label htmlFor="image">
                <img src={assets.gallery_icon} alt="" className="w-5 mr-2 cursor-pointer"/>
            </label>
        </div>
        <img onClick={handleSendMessage} src={assets.send_button} alt="" className="w-7 cursor-pointer" />
    </div>


    </div>
  ) : (
    <div className='flex flex-col items-center justify-center gap-2 text-gray-500 bg-black/40 max-md:hidden'>
        <img src={assets.logo_icon} className='max-w-16' alt="" />
        <p className='text-2xl font-semibold text-white tracking-wide'>ACA <span className='text-aca-red-bright'>Chat</span></p>
        <p className='text-sm text-gray-400'>Select a conversation to start chatting</p>
    </div>
  )
}

export default ChatContainer
