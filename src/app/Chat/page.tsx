"use client";

import React, { useState } from "react";
import { Icon } from "@iconify/react";
import Image from "next/image";

// --- TIPE DATA DUMMY ---
type Message = {
  id: number;
  sender: "me" | "them";
  text: string;
  time: string;
  isRead: boolean;
  type: "text" | "image" | "deal"; // Support tipe pesan lain (misal: penawaran sewa)
};

type ChatRoom = {
  id: number;
  name: string;
  avatar: string;
  isOnline: boolean;
  lastMessage: string;
  unreadCount: number;
  lastTime: string;
  propertyContext?: { // Fitur UX Mahal: Konteks Properti
      name: string;
      price: string;
      image: string;
  }
};

// --- DATA MOCKUP ---
const MOCK_CHATS: ChatRoom[] = [
  {
    id: 1,
    name: "Ibu Kos Hj. Sarah",
    avatar: "https://i.pravatar.cc/150?u=1",
    isOnline: true,
    lastMessage: "Boleh kak, untuk parkir mobil masih tersedia ya.",
    unreadCount: 2,
    lastTime: "10:30",
    propertyContext: {
        name: "Kos Putri Menteng Residence",
        price: "Rp 2.500.000",
        image: "/images/hero/banner.jpg" // Ganti dengan gambar real
    }
  },
  {
    id: 2,
    name: "Admin Kost Executive",
    avatar: "https://i.pravatar.cc/150?u=2",
    isOnline: false,
    lastMessage: "Terima kasih sudah booking.",
    unreadCount: 0,
    lastTime: "Kemarin",
    propertyContext: {
        name: "Executive Suite Kuningan",
        price: "Rp 4.200.000",
        image: "/images/hero/banner.jpg"
    }
  },
];

const MOCK_MESSAGES: Message[] = [
  { id: 1, sender: "me", text: "Halo Bu, apakah kamar tipe VIP masih kosong untuk bulan depan?", time: "10:15", isRead: true, type: "text" },
  { id: 2, sender: "them", text: "Halo Kak Jason! Masih ada kok kak sisa 1 unit lagi di lantai 2.", time: "10:20", isRead: true, type: "text" },
  { id: 3, sender: "me", text: "Kalau parkir mobil aman ga bu? Soalnya saya bawa mobil.", time: "10:22", isRead: true, type: "text" },
  { id: 4, sender: "them", text: "Boleh kak, untuk parkir mobil masih tersedia ya. Biaya tambahannya 200rb per bulan.", time: "10:30", isRead: false, type: "text" },
];

export default function ChatPage() {
  const [selectedChatId, setSelectedChatId] = useState<number | null>(MOCK_CHATS[0].id);
  const [activeChat, setActiveChat] = useState(MOCK_CHATS[0]);
  const [inputMessage, setInputMessage] = useState("");
  const [isMobileListVisible, setIsMobileListVisible] = useState(true); // Logic untuk Mobile View

  const handleSelectChat = (chat: ChatRoom) => {
    setSelectedChatId(chat.id);
    setActiveChat(chat);
    setIsMobileListVisible(false); // Di HP, kalau pilih chat, list hilang, masuk ke room
  };

  const handleBackToMenu = () => {
    setIsMobileListVisible(true);
  };

  return (
    <div className="min-h-screen bg-[#0F0F0F] pt-20 pb-4 px-4 flex justify-center">
        
        {/* MAIN CONTAINER - MAX WIDTH & GLASS EFFECT */}
        <div className="w-full max-w-7xl h-[85vh] bg-[#151515] border border-white/10 rounded-3xl overflow-hidden flex shadow-2xl relative">
            
            {/* =========================================================
                LEFT SIDEBAR (CHAT LIST)
            ========================================================= */}
            <div className={`w-full md:w-[380px] border-r border-white/5 flex flex-col bg-[#151515] absolute md:relative z-20 transition-transform duration-300 h-full ${isMobileListVisible ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
                
                {/* Header Sidebar */}
                <div className="p-5 border-b border-white/5 flex justify-between items-center bg-[#151515]">
                    <h2 className="text-xl font-bold text-white">Pesan</h2>
                    <button className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white hover:bg-white/10 transition">
                        <Icon icon="solar:pen-new-square-bold" />
                    </button>
                </div>

                {/* Search Bar */}
                <div className="px-5 py-3">
                    <div className="relative">
                        <Icon icon="solar:magnifer-linear" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
                        <input type="text" placeholder="Cari pesan..." className="w-full bg-[#1A1A1A] border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-[#86efac]/50 placeholder:text-gray-600"/>
                    </div>
                </div>

                {/* Filter Tabs */}
                <div className="px-5 flex gap-3 mb-2">
                    <button className="px-3 py-1 rounded-full bg-white text-black text-xs font-bold">Semua</button>
                    <button className="px-3 py-1 rounded-full bg-white/5 text-gray-400 border border-white/5 text-xs font-bold hover:bg-white/10">Belum Dibaca</button>
                </div>

                {/* Chat List Scrollable */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {MOCK_CHATS.map((chat) => (
                        <div 
                           key={chat.id}
                           onClick={() => handleSelectChat(chat)}
                           className={`px-5 py-4 flex gap-4 cursor-pointer transition-colors border-b border-white/5 hover:bg-white/5 ${selectedChatId === chat.id ? 'bg-white/5 border-l-4 border-l-[#86efac]' : 'border-l-4 border-l-transparent'}`}
                        >
                            <div className="relative shrink-0">
                                <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-700">
                                    <Image src={chat.avatar} width={48} height={48} alt={chat.name} className="object-cover"/>
                                </div>
                                {chat.isOnline && <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#86efac] border-2 border-[#151515] rounded-full"></div>}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start mb-0.5">
                                    <h4 className={`text-sm font-bold truncate ${selectedChatId === chat.id ? 'text-white' : 'text-gray-200'}`}>{chat.name}</h4>
                                    <span className="text-[10px] text-gray-500 whitespace-nowrap ml-2">{chat.lastTime}</span>
                                </div>
                                <p className={`text-xs truncate ${chat.unreadCount > 0 ? 'text-white font-bold' : 'text-gray-500'}`}>{chat.lastMessage}</p>
                            </div>
                            {chat.unreadCount > 0 && (
                                <div className="flex flex-col justify-center items-end">
                                    <div className="w-5 h-5 rounded-full bg-[#86efac] text-black text-[10px] font-bold flex items-center justify-center">
                                        {chat.unreadCount}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* =========================================================
                RIGHT SIDE (CHAT WINDOW)
            ========================================================= */}
            <div className={`flex-1 flex flex-col bg-[#0F0F0F] relative w-full h-full transition-transform duration-300 ${isMobileListVisible ? 'translate-x-full md:translate-x-0 hidden md:flex' : 'translate-x-0 flex'}`}>
                
                {/* 1. CHAT HEADER (Info User & Konteks Property) */}
                <div className="h-18 px-6 py-3 border-b border-white/5 bg-[#151515] flex justify-between items-center shadow-sm z-10">
                    <div className="flex items-center gap-4">
                        {/* Back Button (Mobile Only) */}
                        <button onClick={handleBackToMenu} className="md:hidden text-white mr-2"><Icon icon="solar:arrow-left-linear" className="text-xl"/></button>
                        
                        <div className="relative">
                             <div className="w-10 h-10 rounded-full bg-gray-700 overflow-hidden">
                                <Image src={activeChat.avatar} width={40} height={40} alt="Avatar"/>
                             </div>
                             {activeChat.isOnline && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#86efac] border-2 border-[#151515] rounded-full"></div>}
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-white">{activeChat.name}</h3>
                            <span className="text-xs text-[#86efac] flex items-center gap-1">
                                {activeChat.isOnline ? 'Online' : 'Terakhir dilihat 10m lalu'}
                            </span>
                        </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex gap-4 text-gray-400">
                        <button className="hover:text-white transition"><Icon icon="solar:phone-calling-linear" className="text-xl"/></button>
                        <button className="hover:text-white transition"><Icon icon="solar:menu-dots-bold" className="text-xl"/></button>
                    </div>
                </div>

                {/* 2. PROPERTY CONTEXT (Fitur UX "Mahal")
                    Muncul di atas chat agar user tidak lupa kamar mana yg dibahas
                */}
                {activeChat.propertyContext && (
                    <div className="bg-[#1A1A1A] px-6 py-3 flex justify-between items-center border-b border-white/5">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-800 relative">
                                <Image src={activeChat.propertyContext.image} fill alt="Prop" className="object-cover"/>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400">Menanyakan properti:</p>
                                <h4 className="text-sm font-bold text-white">{activeChat.propertyContext.name}</h4>
                            </div>
                        </div>
                        <div className="text-right">
                             <p className="text-sm font-bold text-[#86efac]">{activeChat.propertyContext.price}</p>
                             <button className="text-[10px] underline text-gray-400 hover:text-white">Lihat Detail</button>
                        </div>
                    </div>
                )}

                {/* 3. CHAT BODY (MESSAGES) */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#0F0F0F] bg-[url('/images/pattern/chat-pattern.png')] bg-repeat bg-[length:400px]">
                    {/* Timestamp Divider */}
                    <div className="flex justify-center my-4">
                        <span className="bg-[#1A1A1A] text-gray-500 text-[10px] px-3 py-1 rounded-full border border-white/5">Hari Ini</span>
                    </div>

                    {MOCK_MESSAGES.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[70%] md:max-w-[60%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-lg relative group ${
                                msg.sender === 'me' 
                                ? 'bg-[#86efac] text-black rounded-tr-none' // Pesan Kita (Hijau)
                                : 'bg-[#1A1A1A] text-white border border-white/10 rounded-tl-none' // Pesan Mereka (Hitam)
                            }`}>
                                <p>{msg.text}</p>
                                <div className={`flex items-center gap-1 justify-end mt-1 text-[10px] ${msg.sender === 'me' ? 'text-black/60' : 'text-gray-500'}`}>
                                    <span>{msg.time}</span>
                                    {msg.sender === 'me' && (
                                        <Icon icon="solar:check-read-linear" className={msg.isRead ? "text-blue-600 font-bold" : ""} />
                                    )}
                                </div>
                                
                                {/* Dropdown Arrow on Hover */}
                                <button className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Icon icon="solar:alt-arrow-down-bold" className={`text-lg ${msg.sender === 'me' ? 'text-black/50' : 'text-gray-500'}`}/>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* 4. CHAT INPUT FOOTER */}
                <div className="p-4 bg-[#151515] border-t border-white/5">
                    <div className="flex items-end gap-3 max-w-4xl mx-auto">
                        <button className="p-3 text-gray-400 hover:text-white hover:bg-white/5 rounded-full transition">
                            <Icon icon="solar:add-circle-linear" className="text-2xl"/>
                        </button>
                        
                        <div className="flex-1 bg-[#1A1A1A] border border-white/10 rounded-2xl flex items-center px-4 py-3 gap-2 focus-within:border-[#86efac]/50 transition-colors">
                            <button className="text-gray-400 hover:text-yellow-400 transition"><Icon icon="solar:smile-circle-linear" className="text-xl"/></button>
                            <input 
                                type="text" 
                                value={inputMessage}
                                onChange={(e) => setInputMessage(e.target.value)}
                                placeholder="Ketik pesan..." 
                                className="flex-1 bg-transparent text-sm text-white focus:outline-none placeholder:text-gray-600"
                                onKeyDown={(e) => e.key === 'Enter' && alert("Fitur Kirim belum connect API")}
                            />
                            <button className="text-gray-400 hover:text-white transition"><Icon icon="solar:gallery-linear" className="text-xl"/></button>
                        </div>

                        <button className={`p-3 rounded-full transition shadow-lg flex items-center justify-center ${inputMessage.trim() ? 'bg-[#86efac] text-black hover:scale-105' : 'bg-[#2A2A2A] text-gray-500 cursor-not-allowed'}`}>
                            <Icon icon="solar:plain-bold-duotone" className="text-xl -ml-0.5 mt-0.5"/>
                        </button>
                    </div>
                </div>

            </div>
        </div>
    </div>
  );
}