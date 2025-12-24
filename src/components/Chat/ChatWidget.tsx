"use client";

import React, { useState } from "react";
import { Icon } from "@iconify/react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
// 1. IMPORT HOOK CONTEXT
import { useChat } from "@/context/ChatContext";

// Mock Data Chat List
const MOCK_CHATS = [
  { id: 1, name: "Ibu Kos Hj. Sarah", msg: "Parkir aman kak.", time: "10:30", avatar: "https://i.pravatar.cc/150?u=1", unread: 2 },
  { id: 2, name: "Admin Kost Exec", msg: "Siap ditunggu.", time: "Kmrin", avatar: "https://i.pravatar.cc/150?u=2", unread: 0 },
];

export default function ChatWidget() {
  // 2. GUNAKAN STATE DARI CONTEXT (Bukan useState lokal lagi)
  const { isOpen, toggleChat } = useChat();
  
  // State lokal hanya untuk navigasi antar Room/List (ini boleh tetap lokal)
  const [activeChat, setActiveChat] = useState<any>(null);

  const openChatRoom = (chat: any) => setActiveChat(chat);
  const backToList = () => setActiveChat(null);

  return (
    <>
      {/* 1. FLOATING BUTTON TRIGGER (FAB)
         - Di Desktop: Muncul di Pojok Kanan Bawah
         - Di Mobile: Disembunyikan (hidden lg:flex) agar tidak menumpuk dengan tombol di BookingSidebar
      */}
      <div className="fixed bottom-6 right-6 z-[9990] hidden lg:flex flex-col items-end gap-4">
        <button 
          onClick={toggleChat} // Gunakan toggleChat dari Context
          className="w-14 h-14 bg-[#86efac] rounded-full shadow-[0_4px_20px_rgba(134,239,172,0.4)] flex items-center justify-center text-black hover:scale-110 active:scale-95 transition-all group relative"
        >
          <Icon icon={isOpen ? "solar:close-circle-bold" : "solar:chat-round-dots-bold"} className="text-3xl transition-transform group-hover:rotate-12"/>
          {!isOpen && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-[#121212]">2</div>
          )}
        </button>
      </div>

      {/* 2. CHAT WINDOW CONTAINER 
         - Menggunakan 'fixed inset-0' untuk Mobile (Full Screen)
         - Menggunakan 'absolute bottom-20 right-0' untuk Desktop (Popup)
      */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={`
              fixed z-[9999] bg-[#151515] overflow-hidden flex flex-col shadow-2xl backdrop-blur-xl border border-white/10
              
              // MOBILE STYLE (Full Screen)
              inset-0 w-full h-full rounded-none
              
              // DESKTOP STYLE (Popup Kecil)
              lg:inset-auto lg:bottom-24 lg:right-6 lg:w-[380px] lg:h-[600px] lg:rounded-2xl
            `}
          >
            {/* HEADER */}
            <div className="h-16 bg-[#1A1A1A] border-b border-white/5 flex items-center px-4 justify-between shrink-0 relative z-20 safe-area-top">
               {activeChat ? (
                   // Header Room
                   <div className="flex items-center gap-3 w-full">
                       <button onClick={backToList} className="w-10 h-10 flex items-center justify-center rounded-full active:bg-white/10 text-white transition-colors -ml-2">
                          <Icon icon="solar:alt-arrow-left-linear" width="24"/>
                       </button>
                       <div className="w-10 h-10 rounded-full bg-gray-700 overflow-hidden relative border border-white/10">
                           <Image src={activeChat.avatar} fill alt="Av" className="object-cover"/>
                       </div>
                       <div className="flex-1 min-w-0">
                           <h4 className="text-base font-bold text-white truncate">{activeChat.name}</h4>
                           <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-[#86efac]"></span>
                              <p className="text-xs text-gray-400">Online</p>
                           </div>
                       </div>
                       <button className="text-gray-400 p-2 hover:text-white"><Icon icon="solar:menu-dots-bold" className="text-xl"/></button>
                   </div>
               ) : (
                   // Header List
                   <div className="flex items-center justify-between w-full">
                       <h3 className="text-xl font-bold text-white tracking-tight">Pesan Masuk</h3>
                       <button onClick={toggleChat} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                          <Icon icon="solar:close-circle-linear" className="text-xl"/>
                       </button>
                   </div>
               )}
            </div>

            {/* BODY CONTENT */}
            <div className="flex-1 overflow-y-auto bg-[#0F0F0F] custom-scrollbar relative">
                {activeChat ? (
                    // TAMPILAN CHAT ROOM
                    <div className="p-4 space-y-4 pb-20">
                        <div className="flex justify-center">
                           <span className="bg-[#1A1A1A] px-3 py-1 rounded-full text-[10px] text-gray-500 border border-white/5">Hari ini 10:30</span>
                        </div>
                        
                        {/* Bubble Chat User */}
                        <div className="flex justify-end">
                            <div className="bg-[#86efac] text-black px-4 py-3 rounded-2xl rounded-tr-sm text-sm max-w-[85%] shadow-sm">
                                Halo bu, kosan ini masih ada? Saya minat survey besok sore bisa?
                            </div>
                        </div>
                        
                        {/* Bubble Chat Lawan */}
                        <div className="flex justify-start items-end gap-2">
                             <div className="w-6 h-6 rounded-full bg-gray-700 overflow-hidden relative shrink-0 mb-1">
                                <Image src={activeChat.avatar} fill alt="Av" className="object-cover"/>
                             </div>
                             <div className="bg-[#1A1A1A] text-white border border-white/10 px-4 py-3 rounded-2xl rounded-tl-sm text-sm max-w-[85%]">
                                {activeChat.msg}
                             </div>
                        </div>
                    </div>
                ) : (
                    // TAMPILAN CHAT LIST
                    <div className="divide-y divide-white/5">
                        {MOCK_CHATS.map(chat => (
                            <div key={chat.id} onClick={() => openChatRoom(chat)} className="p-4 px-5 flex gap-4 hover:bg-white/5 cursor-pointer transition-colors active:bg-white/10">
                                <div className="relative shrink-0">
                                    <div className="w-12 h-12 rounded-full bg-gray-700 overflow-hidden relative border border-white/5">
                                        <Image src={chat.avatar} fill alt="Av" className="object-cover"/>
                                    </div>
                                    {chat.unread > 0 && <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full border-2 border-[#151515] text-[10px] flex items-center justify-center font-bold text-white shadow-sm">{chat.unread}</div>}
                                </div>
                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                    <div className="flex justify-between items-center mb-1">
                                        <h4 className={`text-sm font-bold truncate ${chat.unread > 0 ? 'text-white' : 'text-gray-300'}`}>{chat.name}</h4>
                                        <span className={`text-[10px] ${chat.unread > 0 ? 'text-[#86efac] font-bold' : 'text-gray-500'}`}>{chat.time}</span>
                                    </div>
                                    <p className={`text-xs truncate leading-relaxed ${chat.unread > 0 ? 'text-white font-medium' : 'text-gray-500'}`}>{chat.msg}</p>
                                </div>
                            </div>
                        ))}
                        
                        {/* Empty State */}
                        {MOCK_CHATS.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full pt-32 text-gray-500">
                                <div className="w-16 h-16 rounded-full bg-[#1A1A1A] flex items-center justify-center mb-4 border border-white/5">
                                   <Icon icon="solar:chat-line-linear" width="32" className="opacity-50"/>
                                </div>
                                <h4 className="text-white font-bold mb-1">Belum ada pesan</h4>
                                <p className="text-xs text-gray-500 max-w-[200px] text-center">Percakapan Anda dengan pemilik kos akan muncul di sini.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* FOOTER INPUT - Fixed Bottom Safe Area */}
            {activeChat && (
                <div className="p-3 bg-[#1A1A1A] border-t border-white/5 safe-area-bottom">
                    <div className="flex items-end gap-2 bg-[#0F0F0F] px-4 py-3 rounded-3xl border border-white/10 focus-within:border-[#86efac]/50 transition-colors">
                        <button className="text-gray-400 hover:text-white pb-0.5"><Icon icon="solar:smile-circle-linear" className="text-xl"/></button>
                        <textarea 
                            rows={1}
                            placeholder="Tulis pesan..." 
                            className="bg-transparent border-none outline-none text-sm text-white flex-1 placeholder:text-gray-600 resize-none max-h-24 py-0.5"
                            style={{ minHeight: '24px' }}
                        />
                        <button className="text-gray-400 hover:text-white pb-0.5"><Icon icon="solar:gallery-linear" className="text-xl"/></button>
                        <button className="w-8 h-8 rounded-full bg-[#86efac] flex items-center justify-center text-black shadow-lg ml-1 active:scale-95 transition-transform">
                            <Icon icon="solar:plain-bold-duotone" className="text-lg -ml-0.5 mt-0.5"/>
                        </button>
                    </div>
                </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}