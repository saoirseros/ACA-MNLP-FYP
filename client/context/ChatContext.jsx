import { createContext, useContext, useEffect, useRef, useState } from "react";
import { AuthContext } from "./AuthContext";
import toast from "react-hot-toast";


export const ChatContext = createContext();

export const ChatProvider = ({ children })=>{

    const [messages, setMessages] = useState([]);
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null)
    const [unseenMessages, setUnseenMessages] = useState({})
    // NLP analysis results keyed by messageId, populated asynchronously as
    // the Python NLP service finishes analyzing each message.
    const [messageAnalyses, setMessageAnalyses] = useState({})
    // Conversation-level analytics (Phase 8) for the currently selected user.
    const [conversationAnalytics, setConversationAnalytics] = useState(null)
    // `false` is useful to distinguish an NLP outage from an analytics
    // request that is still being checked.
    const [nlpAvailable, setNlpAvailable] = useState(null)
    const analyticsRefreshTimeout = useRef(null)

    const {socket, axios, authUser} = useContext(AuthContext);

    // function to get all users for sidebar
    const getUsers = async () =>{
        try {
            const { data } = await axios.get("/api/messages/users");
            if (data.success) {
                setUsers(data.users)
                setUnseenMessages(data.unseenMessages)
            }
        } catch (error) {
            toast.error(error.message)
        }
    }

    // function to get messages for selected user
    const getMessages = async (userId)=>{
        try {
            const { data } = await axios.get(`/api/messages/${userId}`);
            if (data.success){
                setMessages(data.messages)
                if (data.analyses?.length) {
                    setMessageAnalyses((prevAnalyses) => ({
                        ...prevAnalyses,
                        ...Object.fromEntries(data.analyses.map((analysis) => [analysis.messageId, analysis])),
                    }))
                }
            }
        } catch (error) {
            toast.error(error.message)
        }
    }

    // function to get conversation-level analytics (sentiment/emotion/
    // toxicity aggregates, summary, topic, context usage) for the given user
    const getConversationAnalytics = async (userId)=>{
        try {
            const { data } = await axios.get(`/api/messages/analytics/${userId}`);
            if (data.success){
                setConversationAnalytics(data.analytics)
            }
        } catch (error) {
            // Analytics are a secondary feature - fail quietly so a
            // temporary NLP outage doesn't spam the user with toasts.
            console.log(error.message)
        }
    }

    // Collapse a burst of analysis events into one analytics request. The
    // per-message badges still update immediately; only the aggregate view
    // waits briefly for nearby results to arrive.
    const scheduleAnalyticsRefresh = (userId) => {
        if (analyticsRefreshTimeout.current) {
            clearTimeout(analyticsRefreshTimeout.current)
        }
        analyticsRefreshTimeout.current = setTimeout(() => {
            getConversationAnalytics(userId)
            analyticsRefreshTimeout.current = null
        }, 1000)
    }

    // Runs the real Adaptive Context Activation + model-tier cascade
    // pipeline on an arbitrary (text, history) pair, without persisting
    // anything - powers the Algorithm Showcase. Returns null (never
    // throws) if the NLP service is unavailable.
    const simulateMessage = async (text, history = []) => {
        try {
            const { data } = await axios.post("/api/nlp/simulate", { text, history });
            if (data.success) return data.result;
            console.log(data.message);
            return null;
        } catch (error) {
            console.log(error.message);
            return null;
        }
    }

    // function to send message to selected user
    const sendMessage = async (messageData)=>{
        try {
            const {data} = await axios.post(`/api/messages/send/${selectedUser._id}`, messageData);
            if(data.success){
                setMessages((prevMessages)=>[...prevMessages, data.newMessage])
            }else{
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.message);
        }
    }

    // function to subscribe to messages for selected user
    const subscribeToMessages = async () =>{
        if(!socket) return;

        socket.on("newMessage", (newMessage)=>{
            if(selectedUser && newMessage.senderId === selectedUser._id){
                newMessage.seen = true;
                setMessages((prevMessages)=> [...prevMessages, newMessage]);
                axios.put(`/api/messages/mark/${newMessage._id}`);
            }else{
                setUnseenMessages((prevUnseenMessages)=>({
                    ...prevUnseenMessages, [newMessage.senderId] : prevUnseenMessages[newMessage.senderId] ? prevUnseenMessages[newMessage.senderId] + 1 : 1
                }))
            }
        })

        // NLP analysis results arrive asynchronously, after the message
        // itself, so they're handled in a separate event. Once a new
        // analysis lands for the open conversation, refresh the
        // conversation-level analytics too (sentiment progression, etc.)
        socket.on("messageAnalysis", (analysis)=>{
            setMessageAnalyses((prevAnalyses)=>({
                ...prevAnalyses, [analysis.messageId]: analysis
            }))
            if(selectedUser){
                scheduleAnalyticsRefresh(selectedUser._id)
            }
        })
    }

    // function to unsubscribe from messages
    const unsubscribeFromMessages = ()=>{
        if(socket){
            socket.off("newMessage");
            socket.off("messageAnalysis");
        }
    }

    useEffect(()=>{
        subscribeToMessages();
        return ()=>{
            unsubscribeFromMessages();
            if (analyticsRefreshTimeout.current) {
                clearTimeout(analyticsRefreshTimeout.current)
                analyticsRefreshTimeout.current = null
            }
        };
    },[socket, selectedUser])

    useEffect(()=>{
        if (!authUser) return

        const checkNlpHealth = async () => {
            try {
                const { data } = await axios.get("/api/nlp/health")
                setNlpAvailable(data.success && data.available === true)
            } catch {
                // The indicator is informational only; chat remains usable even
                // when this optional health check cannot reach the backend.
                setNlpAvailable(false)
            }
        }
        const initialHealthCheck = setTimeout(checkNlpHealth, 0)
        const healthInterval = setInterval(checkNlpHealth, 30000)
        return () => {
            clearTimeout(initialHealthCheck)
            clearInterval(healthInterval)
        }
    },[authUser, axios])

    useEffect(()=>{
        return () => {
            if (analyticsRefreshTimeout.current) {
                clearTimeout(analyticsRefreshTimeout.current)
            }
        }
    },[])

    const value = {
        messages, users, selectedUser, getUsers, getMessages, sendMessage, setSelectedUser, unseenMessages, setUnseenMessages, messageAnalyses, conversationAnalytics, getConversationAnalytics, nlpAvailable, simulateMessage
    }

    return (
    <ChatContext.Provider value={value}>
            { children }
    </ChatContext.Provider>
    )
}