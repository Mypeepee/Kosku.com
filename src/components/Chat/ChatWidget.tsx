"use client";

import React, { useState } from "react";
import { Icon } from "@iconify/react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";

// Mock Data Chat List
const MOCK_CHATS = [
  { id: 1, name: "Ibu Kos Hj. Sarah", msg: "Parkir aman kak.", time: "10:30", avatar: "https://i.pravatar.cc/150?u=1", unread: 2 },
  { id: 2, name: "Admin Kost Exec", msg: "Siap ditunggu.", time: "Kmrin", avatar: "https://i.pravatar.cc/150?u=2", unread: 0 },
];

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeChat, setActiveChat] = useState<any>(null); // Kalau null = Tampilkan List, Kalau ada object = Tampilkan Room

  // Toggle Buka/Tutup Widget
  const toggleOpen = () => setIsOpen(!isOpen);

  // Masuk ke Room Chat
  const openChatRoom = (chat: any) => setActiveChat(chat);

  // Kembali ke List
  const backToList = () => setActiveChat(null);

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-4">
      
      {/* --- WINDOW CHAT (POPUP) --- */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="w-[360px] h-[500px] bg-[#151515] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col backdrop-blur-xl"
          >
            {/* HEADER */}
            <div className="h-14 bg-[#1A1A1A] border-b border-white/5 flex items-center px-4 justify-between shrink-0">
               {activeChat ? (
                   // Header Room
                   <div className="flex items-center gap-3 w-full">
                       <button onClick={backToList} className="text-gray-400 hover:text-white"><Icon icon="solar:arrow-left-linear" width="20"/></button>
                       <div className="w-8 h-8 rounded-full bg-gray-700 overflow-hidden relative">
                           <Image src={activeChat.avatar} fill alt="Av" className="object-cover"/>
                       </div>
                       <div className="flex-1 min-w-0">
                           <h4 className="text-sm font-bold text-white truncate">{activeChat.name}</h4>
                           <p className="text-[10px] text-[#86efac]">Online</p>
                       </div>
                       <button className="text-gray-400"><Icon icon="solar:menu-dots-bold"/></button>
                   </div>
               ) : (
                   // Header List
                   <div className="flex items-center justify-between w-full">
                       <h3 className="font-bold text-white">Pesan</h3>
                       <button onClick={toggleOpen} className="text-gray-400 hover:text-white"><Icon icon="solar:minimize-square-linear"/></button>
                   </div>
               )}
            </div>

            {/* BODY CONTENT */}
            <div className="flex-1 overflow-y-auto bg-[#0F0F0F] custom-scrollbar">
                {activeChat ? (
                    // TAMPILAN CHAT ROOM (Isi Percakapan)
                    <div className="p-4 space-y-3">
                        <div className="text-center text-[10px] text-gray-500 my-2">Hari ini 10:30</div>
                        {/* Bubble Chat Dummy */}
                        <div className="flex justify-end">
                            <div className="bg-[#86efac] text-black px-3 py-2 rounded-xl rounded-tr-none text-xs max-w-[80%]">
                                Halo bu, kosan ini masih ada?
                            </div>
                        </div>
                        <div className="flex justify-start">
                            <div className="bg-[#1A1A1A] text-white border border-white/10 px-3 py-2 rounded-xl rounded-tl-none text-xs max-w-[80%]">
                                {activeChat.msg}
                            </div>
                        </div>
                    </div>
                ) : (
                    // TAMPILAN CHAT LIST (Daftar Orang)
                    <div className="divide-y divide-white/5">
                        {MOCK_CHATS.map(chat => (
                            <div key={chat.id} onClick={() => openChatRoom(chat)} className="p-4 flex gap-3 hover:bg-white/5 cursor-pointer transition-colors group">
                                <div className="relative">
                                    <div className="w-10 h-10 rounded-full bg-gray-700 overflow-hidden relative">
                                        <Image src={chat.avatar} fill alt="Av" className="object-cover"/>
                                    </div>
                                    {chat.unread > 0 && <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-[#151515] text-[8px] flex items-center justify-center font-bold text-white">{chat.unread}</div>}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between mb-0.5">
                                        <h4 className="text-sm font-bold text-gray-200 group-hover:text-white">{chat.name}</h4>
                                        <span className="text-[10px] text-gray-500">{chat.time}</span>
                                    </div>
                                    <p className="text-xs text-gray-500 truncate group-hover:text-gray-400">{chat.msg}</p>
                                </div>
                            </div>
                        ))}
                        
                        {/* Empty State jika belum ada chat */}
                        {MOCK_CHATS.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full pt-20 text-gray-500">
                                <Icon icon="solar:chat-line-linear" width="40" className="mb-2 opacity-50"/>
                                <p className="text-xs">Belum ada pesan</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* FOOTER (INPUT) - Hanya muncul di Room */}
            {activeChat && (
                <div className="p-3 bg-[#1A1A1A] border-t border-white/5">
                    <div className="flex items-center gap-2 bg-[#0F0F0F] px-3 py-2 rounded-full border border-white/10">
                        <input type="text" placeholder="Tulis pesan..." className="bg-transparent border-none outline-none text-xs text-white flex-1 placeholder:text-gray-600"/>
                        <button className="text-[#86efac]"><Icon icon="solar:plain-bold-duotone"/></button>
                    </div>
                </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- FLOATING TRIGGER BUTTON (FAB) --- */}
      <button 
        onClick={toggleOpen}
        className="w-14 h-14 bg-[#86efac] rounded-full shadow-[0_0_20px_rgba(134,239,172,0.4)] flex items-center justify-center text-black hover:scale-110 active:scale-95 transition-all group"
      >
        <Icon icon={isOpen ? "solar:close-circle-bold" : "solar:chat-round-dots-bold"} className="text-3xl transition-transform group-hover:rotate-12"/>
        {/* Badge Unread Global */}
        {!isOpen && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-[#0F0F0F]">2</div>
        )}
      </button>

    </div>
  );
}