import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Smartphone, Tablet } from 'lucide-react';

interface DevicePreviewProps {
  isOpen: boolean;
  onClose: () => void;
  device: 'phone' | 'tablet';
}

const DEVICES = {
  phone: {
    width: 375,
    height: 812,
    borderRadius: 40,
    frame: 'iPhone 14',
  },
  tablet: {
    width: 768,
    height: 1024,
    borderRadius: 20,
    frame: 'iPad',
  },
};

export default function DevicePreview({ isOpen, onClose, device }: DevicePreviewProps) {
  const [currentDevice, setCurrentDevice] = useState(device);
  const config = DEVICES[currentDevice];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-[210] p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
          >
            <X size={24} />
          </button>

          {/* Device switcher */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[210] flex gap-2">
            <button
              onClick={() => setCurrentDevice('phone')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black text-sm transition-all ${
                currentDevice === 'phone'
                  ? 'bg-[#F59E0B] text-black'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <Smartphone size={16} />
              Phone
            </button>
            <button
              onClick={() => setCurrentDevice('tablet')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black text-sm transition-all ${
                currentDevice === 'tablet'
                  ? 'bg-[#F59E0B] text-black'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <Tablet size={16} />
              Tablet
            </button>
          </div>

          {/* Device frame */}
          <div className="mt-12">
            <div
              className="relative bg-black border-4 border-gray-700 overflow-hidden shadow-2xl"
              style={{
                width: config.width,
                height: config.height,
                borderRadius: config.borderRadius,
              }}
            >
              {/* Status bar */}
              <div className="absolute top-0 left-0 right-0 h-12 bg-[#0F172A] flex items-center justify-between px-6 z-10">
                <span className="text-white text-xs font-bold">9:41</span>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-3 bg-white/80 rounded-sm" />
                  <div className="w-4 h-3 bg-white/80 rounded-sm" />
                  <div className="w-6 h-3 bg-white/80 rounded-sm" />
                </div>
              </div>

              {/* Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120px] h-[30px] bg-black rounded-b-2xl z-20" />

              {/* iframe */}
              <iframe
                src={window.location.href}
                className="w-full h-full border-0"
                style={{
                  width: config.width,
                  height: config.height,
                  transform: 'scale(1)',
                  transformOrigin: 'top left',
                }}
                title="Device Preview"
              />
            </div>

            {/* Device label */}
            <p className="text-center text-white/60 text-sm font-bold mt-3">
              {config.frame} — {config.width} x {config.height}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
