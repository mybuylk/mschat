import React, { useState } from "react";
import { AvatarConfig } from "../types";
import { Smile, Sparkles, Check, Download, Send, RefreshCw } from "lucide-react";

interface AvatarCreatorProps {
  currentConfig?: AvatarConfig;
  onSave: (config: AvatarConfig) => void;
  onSendSticker?: (stickerUrl: string) => void;
  onClose?: () => void;
}

const BG_COLORS = ["bg-emerald-500", "bg-indigo-500", "bg-rose-500", "bg-amber-500", "bg-slate-600", "bg-purple-500"];
const HAIR_STYLES = ["Curly Wave", "Classic Sidepart", "Spiky Buzz", "Long Sleek", "Pigtails", "Top Knot"];
const HAIR_COLORS = ["text-slate-900", "text-amber-800", "text-yellow-600", "text-red-700", "text-pink-600", "text-teal-900"];
const EYE_STYLES = ["Sparkle Eyes", "Cool Glasses", "Classic Clean", "Aesthetic Round", "Starry Eyes"];
const SHIRT_COLORS = ["bg-white", "bg-emerald-100", "bg-amber-100", "bg-rose-100", "bg-blue-100", "bg-purple-100"];
const ACCESSORIES = ["None", "Red Headphones", "Sweet Cap", "Heart Earrings", "Golden Chain", "Bandana"];

export function AvatarCreator({ currentConfig, onSave, onSendSticker, onClose }: AvatarCreatorProps) {
  const [config, setConfig] = useState<AvatarConfig>(
    currentConfig || {
      bgColor: BG_COLORS[0],
      hairStyle: HAIR_STYLES[0],
      hairColor: HAIR_COLORS[0],
      eyesType: EYE_STYLES[0],
      shirtColor: SHIRT_COLORS[0],
      accessory: ACCESSORIES[0]
    }
  );

  const randomize = () => {
    setConfig({
      bgColor: BG_COLORS[Math.floor(Math.random() * BG_COLORS.length)],
      hairStyle: HAIR_STYLES[Math.floor(Math.random() * HAIR_STYLES.length)],
      hairColor: HAIR_COLORS[Math.floor(Math.random() * HAIR_COLORS.length)],
      eyesType: EYE_STYLES[Math.floor(Math.random() * EYE_STYLES.length)],
      shirtColor: SHIRT_COLORS[Math.floor(Math.random() * SHIRT_COLORS.length)],
      accessory: ACCESSORIES[Math.floor(Math.random() * ACCESSORIES.length)]
    });
  };

  const handleSave = () => {
    onSave(config);
  };

  // Sticker Generation: creating styled avatars with action badges
  const stickerTemplates = [
    { name: "Waving Hello 👋", text: "HELLO!", emoji: "👋", emojiBg: "bg-emerald-100 text-emerald-800" },
    { name: "Love Heart ❤️", text: "LUV U!", emoji: "❤️", emojiBg: "bg-rose-100 text-rose-800" },
    { name: "Double Thumbs Up 👍👍", text: "AWESOME!", emoji: "👍", emojiBg: "bg-blue-100 text-blue-800" },
    { name: "Idea Spark 💡", text: "EUREKA!", emoji: "💡", emojiBg: "bg-yellow-105 text-yellow-800" },
    { name: "Facepalm 🤦", text: "OH NO!", emoji: "🤦", emojiBg: "bg-red-100 text-red-800" }
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-150 p-5 shadow-lg w-full max-w-2xl mx-auto fade-in">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-600" />
          <h3 className="text-base font-bold text-slate-800">Custom Avatar Studio</h3>
        </div>
        <button onClick={randomize} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-emerald-600 transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
          <RefreshCw className="w-3.5 h-3.5" />
          Randomize
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Visualizer Area */}
        <div className="flex flex-col items-center justify-center bg-slate-50 rounded-xl p-6 border border-slate-100 relative">
          
          {/* Main customized avatar rendering representation */}
          <div className={`w-36 h-36 rounded-full ${config.bgColor} flex flex-col items-center justify-end overflow-hidden relative shadow-md border-4 border-white transition-all duration-300`}>
            
            {/* Eyes / Glasses layer */}
            <div className="absolute top-12 flex justify-center gap-3 w-full z-15">
              {config.eyesType === "Cool Glasses" ? (
                <div className="bg-slate-900 h-4 w-24 rounded-full flex justify-between px-2.5 items-center shadow-lg border border-slate-700">
                  <div className="w-5 h-2 bg-slate-600 rounded" />
                  <div className="w-2 h-0.5 bg-slate-300" />
                  <div className="w-5 h-2 bg-slate-600 rounded" />
                </div>
              ) : config.eyesType === "Sparkle Eyes" ? (
                <>
                  <div className="w-4 h-4 bg-white rounded-full flex items-center justify-center relative">
                    <span className="w-2.5 h-2.5 bg-slate-900 rounded-full" />
                    <span className="absolute top-0.5 right-0.5 w-1 h-1 bg-white rounded-full" />
                  </div>
                  <div className="w-4 h-4 bg-white rounded-full flex items-center justify-center relative">
                    <span className="w-2.5 h-2.5 bg-slate-900 rounded-full" />
                    <span className="absolute top-0.5 right-0.5 w-1 h-1 bg-white rounded-full" />
                  </div>
                </>
              ) : config.eyesType === "Starry Eyes" ? (
                <div className="flex gap-4 text-amber-300 text-base font-bold select-none">
                  <span>★</span>
                  <span>★</span>
                </div>
              ) : (
                <>
                  <div className="w-3.5 h-3.5 bg-slate-900 rounded-full flex items-center justify-center" />
                  <div className="w-3.5 h-3.5 bg-slate-900 rounded-full flex items-center justify-center" />
                </>
              )}
            </div>

            {/* Accessory layer */}
            {config.accessory !== "None" && (
              <div className="absolute top-6 z-25 text-center text-xs font-bold leading-none select-none">
                {config.accessory === "Red Headphones" && <span className="bg-rose-600 text-white text-[9px] px-2 py-0.5 rounded-full shadow border-2 border-white">🎧 BEATS</span>}
                {config.accessory === "Sweet Cap" && <span className="bg-slate-800 text-white text-[9px] px-2 py-0.5 rounded-full shadow border border-white">🧢 SWAG</span>}
                {config.accessory === "Heart Earrings" && <span className="text-rose-500 text-base">💖</span>}
                {config.accessory === "Golden Chain" && <span className="text-yellow-400 text-lg tracking-tighter">⛓️</span>}
                {config.accessory === "Bandana" && <span className="bg-red-600 text-white text-[8px] px-1.5 py-0.5 rounded border">Bandana</span>}
              </div>
            )}

            {/* Nose & Smile */}
            <div className="absolute top-18 flex flex-col items-center gap-0.5 z-10 w-full">
              <div className="w-2.5 h-2.5 bg-rose-200/90 rounded-full" />
              <div className="w-8 h-4 border-b-2 border-slate-900 rounded-full" />
            </div>

            {/* Hair Layer style and color */}
            <div className={`absolute top-2 w-28 text-center text-xs font-extrabold ${config.hairColor} uppercase tracking-tight z-20`}>
              {config.hairStyle}
            </div>

            {/* Shirt Layer representation with customizable background style */}
            <div className={`h-11 w-24 rounded-t-3xl ${config.shirtColor} border-t-2 border-slate-300 relative flex justify-center items-center`}>
              <div className="w-1.5 h-1.5 bg-slate-950 rounded-full absolute top-1.5" />
              <div className="w-1.5 h-1.5 bg-slate-950 rounded-full absolute top-4" />
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">CREW</span>
            </div>

          </div>

          <div className="mt-4 text-xs font-bold text-slate-700 bg-white border border-slate-150 px-3 py-1 rounded-full shadow-xs">
            {config.hairStyle} ({config.eyesType})
          </div>

          <button onClick={handleSave} className="mt-5 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow cursor-pointer">
            <Check className="w-4 h-4" /> Save as Profile Image
          </button>
        </div>

        {/* Configuration settings panel */}
        <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
          {/* Background color select */}
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Background Theme</label>
            <div className="flex flex-wrap gap-2">
              {BG_COLORS.map((bg) => (
                <button
                  key={bg}
                  onClick={() => setConfig({ ...config, bgColor: bg })}
                  className={`w-7 h-7 rounded-full ${bg} border-2 transition-transform cursor-pointer ${config.bgColor === bg ? "border-slate-800 scale-110 shadow" : "border-transparent hover:scale-105"}`}
                />
              ))}
            </div>
          </div>

          {/* Hair Styles select */}
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Hair Cut</label>
            <div className="grid grid-cols-3 gap-1.5">
              {HAIR_STYLES.map((style) => (
                <button
                  key={style}
                  onClick={() => setConfig({ ...config, hairStyle: style })}
                  className={`px-2 py-1 text-[11px] font-semibold border rounded-lg transition-colors cursor-pointer truncate ${config.hairStyle === style ? "bg-emerald-50 border-emerald-500 text-emerald-800" : "bg-white border-slate-205 text-slate-700 hover:bg-slate-50"}`}
                >
                  {style}
                </button>
              ))}
            </div>
          </div>

          {/* Hair Colors select */}
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Color Tones</label>
            <div className="flex flex-wrap gap-2">
              {HAIR_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setConfig({ ...config, hairColor: color })}
                  className={`text-xs px-2.5 py-1 font-bold border rounded-lg transition-colors cursor-pointer ${config.hairColor === color ? "bg-slate-850 border-slate-850 text-white" : "bg-white border-slate-200 text-slate-800 hover:bg-slate-50"}`}
                >
                  ●
                </button>
              ))}
            </div>
          </div>

          {/* Eye Options select */}
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Glasses & Vision</label>
            <div className="grid grid-cols-2 gap-1.5">
              {EYE_STYLES.map((eye) => (
                <button
                  key={eye}
                  onClick={() => setConfig({ ...config, eyesType: eye })}
                  className={`px-2 py-1 text-[11px] font-semibold border rounded-lg transition-colors cursor-pointer truncate ${config.eyesType === eye ? "bg-emerald-50 border-emerald-500 text-emerald-800" : "bg-white border-slate-200 text-slate-700"}`}
                >
                  {eye}
                </button>
              ))}
            </div>
          </div>

          {/* Shirt Colors select */}
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Apparel styling</label>
            <div className="flex flex-wrap gap-2">
              {SHIRT_COLORS.map((shirt) => (
                <button
                  key={shirt}
                  onClick={() => setConfig({ ...config, shirtColor: shirt })}
                  className={`text-xs px-2.5 py-1 font-bold border rounded-lg transition-colors cursor-pointer ${config.shirtColor === shirt ? "bg-slate-800 text-white" : "bg-white border-slate-200 text-slate-800 hover:bg-slate-51"}`}
                >
                  Shirt
                </button>
              ))}
            </div>
          </div>

          {/* Accessory option select */}
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Flair & Jewelry</label>
            <div className="grid grid-cols-2 gap-1.5">
              {ACCESSORIES.map((acc) => (
                <button
                  key={acc}
                  onClick={() => setConfig({ ...config, accessory: acc })}
                  className={`px-2 py-1 text-[11px] font-semibold border rounded-lg transition-colors cursor-pointer truncate ${config.accessory === acc ? "bg-emerald-50 border-emerald-500 text-emerald-800" : "bg-white border-slate-200 text-slate-700"}`}
                >
                  {acc}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>

      {onSendSticker && (
        <div className="border-t border-slate-100 mt-6 pt-4">
          <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2.5">Send custom Avatar stickers in chat!</h4>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {stickerTemplates.map((template) => {
              // Creating a simulated sticker base64 image or rich styling
              const dispatchSticker = () => {
                const specCode = `sticker||${config.bgColor}||${config.hairStyle}||${config.hairColor}||${config.eyesType}||${config.shirtColor}||${config.accessory}||${template.text}||${template.emoji}`;
                onSendSticker(specCode);
              };

              return (
                <button
                  key={template.name}
                  onClick={dispatchSticker}
                  className="flex flex-col items-center justify-center p-2.5 border border-slate-150 hover:border-emerald-505 rounded-xl bg-slate-50 hover:bg-emerald-50/20 cursor-pointer transition-all hover:scale-102"
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-xs text-lg ${template.emojiBg}`}>
                    {template.emoji}
                  </div>
                  <span className="text-[10px] font-bold text-slate-700 mt-1.5 text-center line-clamp-1">{template.text}</span>
                  <span className="text-[8px] text-slate-400 mt-0.5 flex items-center gap-0.5">
                    <Send className="w-2 h-2" /> Send
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
